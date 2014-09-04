var async = require('async');
var util = require('util');
var config = require('config');
var request = require('request');
var queue = require('./queue');
var npm = require('../npm');
var logger = require('app-logger')('sync');


var maxQueueSize = config.sync['max-queue-size'];
var batchSize = config.sync['batch-size'];
var batchDelay = config.sync['batch-delay'];
var interval = config.sync.interval;

var esUrl = config.elasticsearch.host;
var esIndex = config.elasticsearch.index;


var updated_timestamp = Date.now();
var since_date;


module.exports = function() {

  var esSinceUrl = esUrl + '/' + esIndex + '/config/since_date';
  logger.debug('es since config: ' + esSinceUrl);
  async.waterfall([
    function(cb) {
      request.get({
        url : esSinceUrl,
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
    
    var updateMark = (function() {
      var marks = [];
      return function(updatedon) {
        if (marks.length > 10) {
          marks.length = 0;
          // update mark in elasticsearch
          request.put({
            url : esSinceUrl,
            json : {
              value: updatedon
            }
          }, function(err) {
            if(err) {
              logger.error({err: err}, 'update since_date failed:');
            }else {
              logger.info('updated since_date to: ' + updatedon);
            }
          });
        }else {
          marks.push(updatedon);
        }
      };
    })();


    
    run();



    function run() {
      if (queue.length() < maxQueueSize) {
        
        // request view
        npm.findUpdated(since_date, batchSize, function(err, rs) {
          if (err) 
            logger.error(err);
          else if (rs && rs.length) {
            // get updated
            queue.push(
              rs.map(function(row) {
                // push to queue
                return {
                  name: row.id,
                  updatedOn: row.key
                };
              }), function(err){
                if(err)
                  logger.error({err: err}, 'failed to sync package change: ' + this.data.name);
                else
                  updateMark(this.data.updatedOn);
              });
            
            since_date = rs[rs.length - 1].key;
          }

          // run next batch
          return setTimeout(run, batchDelay);
        });
      }else
        return setTimeout(run, batchDelay);
    }
  });
  

};
