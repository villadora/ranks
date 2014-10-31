var async = require('async');
var util = require('util');
var config = require('config');
var request = require('request');
var follow = require('follow');
var queue = require('./queue');
var npm = require('../npm');
var logger = require('app-logger')('sync');

var registry = config.registry;

var maxQueueSize = config.sync['max-queue-size'];
var interval = config.sync.interval;

var esUrl = config.elasticsearch.host;
var esIndex = config.elasticsearch.index;


module.exports = function() {
  var since;
  var esSinceUrl = esUrl + '/' + esIndex + '/config/since';
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
          since = body._source.value;
        } else {
          since = 0;
        }
        cb();
      });
    }
  ], function(err) {
    if (err) return logger.error(err);

    logger.info(util.format('start sync updated from seq : %s', since));

    // request view
    follow({
      db:config.couchdb,
      since: since,
      include_docs: true
    }, function(err, change) {
      var self = this;
      if (err) return logger.error(err);

      if (!change) {
        return;
      }

      
      if (!change.id) {
        return logger.info('SKIP change', change);
      }

      // only allow N items into
      // the queue at the same time.
      // otherwise a backlog can be
      // created which fills memory.
      if (queue.length() < maxQueueSize) {
        queue.push(change, function(err) {
          if (err) logger.error({err: err}, 'faild to sync change: ' + change.id);
          // TODO: update since seq
          // updateSince(change.seq);
        });
      } else {
        this.pause();
        queue.drain = function() {
          self.resume();
        };
      }
    });

    
    function updateSince(s) {
      if (s - since > interval) {
        since = s;
        // update mark in elasticsearch
        request.put({
          url : esSinceUrl,
          json : {
            value: since
          }
        }, function(err) {
          if(err) {
            logger.error({err: err}, 'update since failed:');
          }else {
            logger.info('updated since to: ' + since);
          }
        });
      }
    }

  });
  

};
