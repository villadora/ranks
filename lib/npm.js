var config = require('config');
var couch = require('couch-db');
var View = couch.View;

var updatedView = new View(config.registry + '/-/_view/updated', 'updated');

module.exports.findUpdated = function(since, limit, cb) {
  updatedView.query({
    limit: limit,
    startkey: since
  }).execute(cb);
};
