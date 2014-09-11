var restify = require('restify');
var logger = require('app-logger')('restify');
var queue = require('./sync/queue');

var server = restify.createServer({
  name: 'sync-admin-server',
  version: require('../package.json').version
});

server.get('/stat/queue', function(req, res, next) {
    res.send(queue.stat());
    next();
});



module.exports = server;

//listen(8080, function() {
//    console.log('%s listening at %s', server.name, server.url);
//  });
