
/* global: describe, it */

describe('elasticsearch client', function() {
  var client = require('../lib').elastic;
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
