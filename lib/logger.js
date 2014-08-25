var _ = require('underscore');
var bunyan = require('bunyan');
var config = require('config');


var level = config.log.level || 'info';

var dest =  [{
  level: level,
  stream: process.stdout            // log INFO and above to stdout
}];


if (config.log.path) {
  dest.push({
    level: level,
    path: config.log.path
  });
}

var logger = bunyan.createLogger({
  name: "ranks",
  streams: dest,
  level: config.log.level || 'debug'
});


module.exports = function(name, data) {
  return logger.child(_.defaults({ component: name }, data));
};
