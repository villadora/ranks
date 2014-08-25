var async = require('async');
var config = require('config');
var request = require('request');
var couch = require('couch-db');
var View = couch.View;

var queue = require('./queue');

var esUrl = config.elasticsearch.host;
var logger = require('app-logger')('sync');

// config
var batchSize = config.sync['batch-size'];
var registry = config.sync.registry;
queue.interval = config.sync.interval * 1000;

var updated_timestamp = Date.now();
var last_startkey = [];
var since_date;


module.exports = function(start_date) {
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

  });
  
};





function syncFrom(date, limit, cb) {

}


