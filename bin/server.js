#!/usr/bin/env node

var mongo = require('mongoskin'),
    mongoUri = process.env.MONGOLAB_URI || process.env.MONGOLAB_URL || 'mongodb://localhost:27017/ranks';

var app = require('../lib');

var port = process.env.PORT || 8080;

app.listen(port, function() {
    console.log("Listening on " + port + "...");
});
