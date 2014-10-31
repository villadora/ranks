
/* global: describe, it */

describe('elasticsearch client', function() {
  var client = require('../lib').elastic;

  it('getDependents', function(done) {
    client.getDependents('colors', function(err, dependents) {
      console.log(dependents);
      done(err);
    });
  });

  it('getScore', function(done) {
    client.getScores(['Reston', 'daemon-tools'], function(err, score) {
      console.log(score);
      done(err);
    });
  });

  it('getPackage', function(done) {
    client.getPackage('Reston', function(err, doc) {
      console.log(doc);
      done();
    });
  });

  it('ping', function(done) {
    client.ping({
      // ping usually has a 100ms timeout
      requestTimeout: 1000,

      // undocumented params are appended to the query string
      hello: "elasticsearch!"
    }, function (error) {
      if (error) {
        console.trace('elasticsearch cluster is down!');
      } else {
        console.log('All is well');
      }

      done(error);
    });
  });

});
