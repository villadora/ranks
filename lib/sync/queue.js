var async = require('async');
var retry = require('retry');
var config = require('config');
var npm = require('../npm');
var logger = require('app-logger')('sync:queue');

var esUrl = config.elasticsearch.host;

// config
var interval = config.sync.interval;
var concurrency = config.sync.concurrency;


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
        logger.debug('drop duplicate task: ' + JSON.stringify(task));
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

var queue = async.dedupQueue(function(task, cb) {
  setTimeout(function() {
    var name = task.name;
    

    console.log('execute task:', task.name);
    cb();
  }, interval);
}, function(a, b) {
  if(a && b)  {
    return a.name == b.name;
  }
  return a === b;
}, concurrency);

module.exports =  queue;



function only_once(fn) {
  var called = false;
  return function() {
    if (called) throw new Error("Callback was already called.");
    called = true;
    fn.apply(this, arguments);
  }
}
