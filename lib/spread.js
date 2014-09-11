var config = require('config');
var request = require('request');

var registry = config.registry;


          // change its own score
module.exports.calculateBaseScore = function (p) {
  return 1;
};

