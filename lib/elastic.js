var elasticsearch = require('elasticsearch');
var config = require('config').elasticsearch;

module.exports = createClient();

module.exports.createClient = createClient;

function createClient() {
  return new elasticsearch.Client({
    host: config.host,
    log: config.log
  });
}


