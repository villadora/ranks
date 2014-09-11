var elasticsearch = require('elasticsearch');
var esq = require('elastic.js');
var config = require('config').elasticsearch;

var TYPE = 'package';

module.exports = createClient();

module.exports.createClient = createClient;

function createClient() {
  return new elasticsearch.Client({
    host: config.host,
    log: config.log
  });
}



module.exports.updatePackage = function(id, pdoc, cb) {
  this.update({
    index: config.index,
    type: TYPE,
    id: id,
    body: {
      // put the partial document under the `doc` key
      doc: pdoc || {}
    }
  }, function (err, res) {
    cb(err);
  });
};

module.exports.sumScore = function(ids, cb) {
  if (typeof ids == 'string')
    ids = [ids];

  if (!(ids && ids.length)) {
    return cb(null, 0);
  }


  this.mget({
    index: config.index,
    type: TYPE,
    _source: [ "name", "basescore", "score", "spread" ],
    body: {
      ids: ids
    }
  }, function (err, body) {
    if (err) return cb(err);
    
    if (!body) return cb(err, 0);

    var docs = body.docs;
    if (!docs) return cb(err, 0);
    return cb(err, docs.reduce(function(sum, doc) {
      doc = doc._source;
      console.log(doc);
      return sum + (doc ? (doc.score || doc.basescore) : 0);
    }, 0));

  });
};

module.exports.getDependents = function(ids, cb) {
  ids = ids || [];

  if (typeof ids == 'string') {
    ids = [ids];
  }

  this.search({
    index: config.index,
    _source: ['name', 'version', 'score', 'dependencies', 'basescore'],
    body: {
      query: {
        bool : {
          must : {
            terms : { 
              dependencies: ids
            }
          }
        }
      }
    }
  }, function(err, rs) {
    if (err) return cb(err);
    var dpts = {};
    ids.forEach(function(id) { dpts[id] = []; });

    if (!rs) return cb(err, {});
    var hits = rs.hits;
    if (!hits || !hits.hits) return cb(err, {});
    
    hits = hits.hits;
    hits.forEach(function(p) {
      p = p._source;
      ids.forEach(function(id) {
        if (~p.dependencies.indexOf(id))
          dpts[id].push(p.name);
      });
    });

    cb(err, dpts);
  });
};

module.exports.getDependentsNumber = function(ids, cb) {
  ids = ids || [];

  if (typeof ids == 'string') {
    ids = [ids];
  }

  this.search({
    index: config.index,
    _source: ['name', 'version', 'score', 'dependencies', 'basescore'],
    body: {
      "aggs" : {
        "dependent": {
          filter: {
            bool : {
              must : {
                terms : { 
                  dependencies: ids
                }
              }
            }
          },
          "aggs": {
            "dependents": {
              terms: { 
                field: "dependencies",
                size : 0
              }
            }
          }
        }
      }
    }
  }, function(err, rs) {
    if (err) return cb(err);
    if (!rs) return cb(err, []);
    var aggs = rs.aggregations;
    if (!aggs || !aggs.dependent || !aggs.dependent.dependents) return cb(err, []);
    
    var dependents  = aggs.dependent.dependents;;
    console.log(rs);

    cb(err, dependents);
  });
};


module.exports.getPackage = function (id, cb) {
  this.get({
    index: config.index,
    type: TYPE,
    id: id,
    _source: ['name', 'version', 'score', 'basescore']
  }, function (err, body, status) {
    cb(err, body, status);
  });  
};

module.exports.deletePackage = function(id, cb) {
  this.delete({
    index: config.index,
    type: 'package',
    id: id
  }, function(err, res, status) {
    cb(err, res, status);
  });
};


