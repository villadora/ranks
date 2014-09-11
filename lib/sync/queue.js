var util = require('util');
var async = require('async');
var retry = require('retry');
var config = require('config');
var npm = require('../npm');
var logger = require('app-logger')('sync:queue');
var request = require('request');

// config
var concurrency = config.sync.concurrency;
var spread = require('../spread');

async.dedupQueue = function (worker, testEqual, concurrency) {
  if (typeof testEqual != 'function') {
    concurrency = testEqual;
    testEqual = undefined;
  }

  if (concurrency === undefined) {
    concurrency = 1;
  }
  function _insert(q, data, pos, callback) {
    if (!q.started){
      q.started = true;
    }
    if (!Array.isArray(data)) {
      data = [data];
    }
    if(data.length == 0) {
      // call drain immediately if there are no tasks
      return async.setImmediate(function() {
        if (q.drain) {
          q.drain();
        }
      });
    }
    data.forEach(function(task) {
      var item = {
        data: task,
        callback: typeof callback === 'function' ? callback : null
      };

      var dup = false;
      q.tasks.forEach(function(t) {
        if (dup) return;

        if (testEqual) {
          dup = testEqual(t.data, task);
        }else {
          dup = t.data == task;
        }
      });

      if (dup) {
        logger.debug('drop duplicate task: ' + (task.name || ''), task);
        return;
      }
      
      if (pos) {
        q.tasks.unshift(item);
      } else {
        q.tasks.push(item);
      }

      if (q.saturated && q.tasks.length === q.concurrency) {
        q.saturated();
      }
      async.setImmediate(q.process);
    });
  }

  var workers = 0;
  var q = {
    tasks: [],
    concurrency: concurrency,
    saturated: null,
    empty: null,
    drain: null,
    started: false,
    paused: false,
    push: function (data, callback) {
      _insert(q, data, false, callback);
    },
    kill: function () {
      q.drain = null;
      q.tasks = [];
    },
    unshift: function (data, callback) {
      _insert(q, data, true, callback);
    },
    process: function () {
      if (!q.paused && workers < q.concurrency && q.tasks.length) {
        var task = q.tasks.shift();
        if (q.empty && q.tasks.length === 0) {
          q.empty();
        }
        workers += 1;
        var next = function () {
          workers -= 1;
          if (task.callback) {
            task.callback.apply(task, arguments);
          }
          if (q.drain && q.tasks.length + workers === 0) {
            q.drain();
          }
          q.process();
        };
        var cb = only_once(next);
        worker(task.data, cb);
      }
    },
    length: function () {
      return q.tasks.length;
    },
    running: function () {
      return workers;
    },
    idle: function() {
      return q.tasks.length + workers === 0;
    },
    pause: function () {
      if (q.paused === true) { return; }
      q.paused = true;
    },
    resume: function () {
      if (q.paused === false) { return; }
      q.paused = false;
      // Need to call q.process once per concurrent
      // worker to preserve full concurrency after pause
      for (var w = 1; w <= q.concurrency; w++) {
        async.setImmediate(q.process);
      }
    }
  };
  return q;
};



var esclient = require('../elastic');
var normalize = require('npm-normalize');

var esurl =  config.elasticsearch.host + '/' + config.elasticsearch.index;

var spreadQueue = async.queue(function(changes, cb) {
  var names = changes.map(function(c) { return c.name; });
  var diffs = changes.map(function(c) { return c.diff; });

  var basescore = p.basescore || 0;
  var origin_score = p.score || 0;

  var dependencies = p.dependencies || [];

  // calcaulate score
  esclient.sumScore(dependencies, function(err, score) {
    console.log(score, dependencies);
    if (err) return cb(err);
    p.score = basescore + (score || 0);
//    console.log(p.score, origin_score);

    // no change
    if (Math.abs(p.score - origin_score) <= 1e5) return cb();

    esclient.updatePackage(name, {
      score: p.score
    }, function(err) {
      if (err) logger.warn({err: err}, util.format('update score for %s failed', name));
      
      // get dependent
      esclient.getDependent(name, function(err, dependents) {
        spreadQueue.push(dependents);
        cb();
      });
    });
  });

}, concurrency);


var queue = async.dedupQueue(function(change, cb) {
    // Remove the document from elasticsearch
    if (change.deleted) {
      return esclient.deletePackage(change.id,  function (err, response) {
        if (err) 
          logger.error({err: err, change_id: change.id}, 'can not delete document ' + change.id);
        else {
          logger.info('DELETE ' + change.id, {change_id: change.id});
          // spread
          
        }

        cb(err);
      });
    }

  var p = normalize(change.doc);

  if (!p || !p.name) {
    logger.info('SKIP ' + change.doc._id);
    return cb();
  }

  if (p.scripts && p.scripts.bin) {
    p.bin = true;
  }


  delete p.users;
  delete p.scripts;
  delete p.time;
  delete p.times;
  delete p.repository;
  delete p.homepage;

  async.parallel([
    function (cb) {
      // get download counts for the last week
      request({
        uri: 'https://api.npmjs.org/downloads/point/last-week/' + p.name,
        json: true,
        method: 'GET'
      }, function (e, r, bw) {
        if (e || bw.error) {
          logger.error(e ? e.message : bw.error, p);
        } else {
          p.dlWeek = bw.downloads;
        }

        cb();
      });
      },
    function (cb) {
      // get download counts for the last month
      request({
        uri: 'https://api.npmjs.org/downloads/point/last-month/' + p.name,
        json: true,
        method: 'GET'
      }, function(e, r, bm) {
        if (e || bm.error) {
          logger.error(e ? e.message : bm.error, p);
        } else {
          p.dlMonth = bm.downloads;
        }
        cb();
      });
    }], function(err, downloads) {
      logger.debug('execute task:', change.id);
      
      // change its own score
      var basescore = spread.calculateBaseScore(p);
      p.basescore = basescore;
      
      request.put({
        url: esurl + '/package/' + p.name,
        json: p
      }, function(e, r, b) {
        if (e) {
          logger.error(e.message, p);
        } else if (b.error) {
          logger.error(b.error, p);
        } else {
          logger.info(['ADD', p.name, 'status = ', r.statusCode, 'queue backlog = ', queue.length()].join(' '));
        }

        // spread
        spreadQueue.push(p);
        
        //          logger.error({err: err}, util.format('can not get package from elasticsearch: %s', p.name));
        
        setTimeout(cb, 1000);
      });
    });
}, function(a, b) {
  if(a && b)  {
    return a.name == b.name;
  }
  return a === b;
}, concurrency);


module.exports =  queue;

module.exports.stat = function() {
  return {
    spreadQuueue: {
      length: spreadQueue.length(),
      running: spreadQueue.running()
    },
    queue: {
      length: queue.length(),
      running: queue.running()
    }
  };
};

function only_once(fn) {
  var called = false;
  return function() {
    if (called) throw new Error("Callback was already called.");
    called = true;
    fn.apply(this, arguments);
  }
}
