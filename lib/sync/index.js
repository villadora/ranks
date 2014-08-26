var async = require('async');
var util = require('util');
var config = require('config');
var request = require('request');
var couch = require('couch-db');
var View = couch.View;
var queue = require('./queue');
var logger = require('app-logger')('sync');


var maxQueueSize = config.sync['max-queue-size'];
var interval = config.sync.interval;
var esUrl = config.elasticsearch.host;


var updated_timestamp = Date.now();
var since_date;

module.exports = function() {
  async.waterfall([
    function(cb) {
      request.get({
        url : esUrl + '/config/since_date',
        json: true
      }, function(err, res, body) {
        if (!res) {
          logger.error('ERROR:', 'could not connect to elasticsearch (' + esUrl + ')');
          return cb(new Error('could not connect to elasticsearch (' + esUrl + ')'));
        }
        if (!err && body && body._source && body._source.value) {
          since_date = body._source.value;
        } else {
          since_date = 0;
        }
        cb();
      });
    }
  ], function(err) {
    if (err) return logger.error(err);

    logger.info(util.format('start sync updated from : %s', since_date));
    
    function run() {
      if (queue.length() > maxQueueSize) {
        return setTimeout(run, interval * maxQueueSize / 10);
      }
      
      // request view

      // get updated
      
      // push to queue

      // run next batch
    }
  });
  
};
