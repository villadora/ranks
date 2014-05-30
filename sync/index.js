var config = require('config').Sync;
var couch = require('couch-db');
var View = couch.View;
var neo4j = require('neo4j');




// config
var batchSize = config['batch-size'];
var registry = config['registry'];

var updated_timestamp = Date.now();
var last_startkey = [];


var db = new neo4j.GraphDatabase(config.neo4j);



