#!/usr/bin/env node

var lib = require('../lib/app');

var port = process.env.PORT || 8080;

app.listen(port, function() {
    console.log("Listening on " + port + "...");
});
