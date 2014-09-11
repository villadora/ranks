#!/usr/bin/env node

var sync = require('../lib').sync;
var restify = require('../lib').restify;

sync();

var adminPort = 4433;
restify.listen(adminPort, function() {
  console.log('%s listening at %s', restify.name, adminPort);
});
