var util = require('util');
var async = require('async');
var retry = require('retry');
var config = require('config');
var npm = require('../npm');
var logger = require('app-logger')('sync:queue');
var request = require('request');
var _ = require('underscore');

/* cache of package's dependents */
var dcache = require('lru-cache')({
  max: 1000,
  maxAge: 1000 * 60 * 60 * 24 * 2
});

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

var spreadQueue = async.queue(function(task, done) {
  var names = task.data;
  esclient.getPackages(names, ['basescore', 'score', 'name', 'dependencies'], function(err, pkgs) {
    if (!err) {
      var dpts = {};
      console.log(names);
      var nocached = names.filter(function(d) {
        if (dcache.has(d)) {
          dpts[d] = dcache.get(d);
          return false;
        }
        return true;
      });


      // no cache
      esclient.getDependents(nocached, function(err, dependents) {
        if (!err) {
          // merge dependents
          _.extend(dpts, dependents);
        }

        for (var name in dependents) {
          dcache.set(name, dependents[name] || []);
        }
        
        var nextspread = [];
        async.each(names, function(name, cb) {
          var pkg = pkgs[name];
          if (!pkg) return cb();
          // TODO:
          var dependents = dpts[name];
          esclient.getPackages(dependents, function(err, docs) {
            var dptscore = docs.reduce(function(sum, d) {
              if (d.dependencies.length)
                return sum + (d.score || 0) / d.dependencies.length;
              return sum;
            }, 0);
            
            // calculate current score
            pkg.score = pkg.basescore + dptscore;
            
            // save update score
            esclient.updatePackage(pkg.name, {
              score: pkg.score
            }, function(err) {
              if (!err) {
                logger.info('update score for ' + pkg.name + ' to: ' + pkg.score);
                _.union(nextspread, pkg.dependencies);
              }else {
                logger.warn({err: err}, util.format('update score for %s failed', pkg.name));
              }
              cb();
            });
          });
        }, function(err) {
          if (nextspread && nextspread.length) {
            spreadQueue.push( {
              data: nextspread
            });
          }

          done();
        });
      });
    }else {
      logger.warn('failed to get package in spread update');
      done();
    }
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
        // no spread because the dependents should change, too
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

  var oldscore = 0;
  var newadds = [];
  var newdels = [];
  async.parallel([
    function (cb) {
      // clean old cache and get old score
      esclient.getPackages(p.name, ["name", "score", "dependencies"], function(err, docs) {
        if (err) return cb(err);
        
        if (!docs.length) return cb();

        docs.forEach(function(doc) {
          var ud = _.union(p.dependencies, doc.dependencies);
          Array.prototype.push.apply(newadds,  _.without(ud, doc.dependencies)); // in new doc, but not in old doc
          Array.prototype.push.apply(newdels, _.without(ud, p.dependencies)); // in old doc, but not in new doc

          if (!oldscore) {
            oldscore = doc.score || 0;
          }
        });
        
        [newadds, newdels] .forEach(function(ch) {
          ch.forEach(dcache.del);
        });
        
        cb();
      });
    },
    function (cb) {
      // update dependencies
      esclient.updatePackage(p.name, { dependencies: p.dependencies }, function(err) {
        cb(err);
      });
    },
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
      if (err) {
        logger.error({err: err});
        return cb();
      }

      logger.debug('execute task:', change.id);
      
      // change its own score
      var basescore = spread.calculateBaseScore(p);
      p.basescore = basescore;

      async.waterfall([
        // get dependents of dependencies
        function(cb) {
          var dependents = [];
          // has cache
          if (dcache.has(p.name)) {
            dependents = dcache.get(p.name);
            cb(null, dependents);
          }else {
            // no cache
            esclient.getDependents(p.name, function(err, dependents) {
              if (err) return cb(err);
              for (var name in dependents) {
                dcache.set(name, dependents[name] || []);
              }
              
              cb(null, dependents);
            });
          }
        }, function(dependents, cb) {
          esclient.getPackages(dependents, ['name', 'score', 'dependencies'],  cb);
        }], function(err, dpts) {
          if (err) {
          logger.error({err: err}, util.format('can not get score/dependents from elasticsearch: %s', p.name));
          return cb();
        }
        
        var dptscore = dpts.reduce(function(sum, d) {
          if (d.dependencies.length)
            return sum + (d.score || 0) / d.dependencies.length;
          
          return sum;
        }, 0);
        
        // calculate current score
        p.score = p.basescore + dptscore;
        logger.info(oldscore, p.score, dptscore, p.dependencies, dpts.map(function(d) { return d.name; }));
        
        // create/update new
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
            // spread
            if (p.dependencies && p.dependencies.length) {
              spreadQueue.push( {
                data: p.dependencies
              });
            }

            // give time for http request
            return setTimeout(cb, 200);
          }
          return cb();
        });
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
    spreadQueue: {
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
