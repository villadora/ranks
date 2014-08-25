
// init logger
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

require('app-logger').init({
  name: "ranks",
  streams: dest,
  level: config.log.level || 'debug'
});


module.exports.elastic = require('./elastic');
