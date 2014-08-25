var async = require('async');
var config = require('config');
var request = require('request');
var couch = require('couch-db');
var View = couch.View;

var queue = require('./queue');

var esUrl = config.elasticsearch.host;

// config
var batchSize = config.sync['batch-size'];
var registry = config.sync.registry;
queue.interval = config.sync.interval * 1000;

var updated_timestamp = Date.now();
var last_startkey = [];


module.exports = function(start_date) {
  async.waterfall([
    function(cb) {
      request.get({
        url : esUrl + '/config/since_date',
        json: true
      }, function(err, res, body) {
        if (!res) {
          console.error('ERROR:', 'could not connect to elasticsearch (' + esUrl + ')');
        }
      });
    }
  ], function(err) {

  });
  
};





function syncFrom(date, limit, cb) {

}


