var Npm = require('../lib/npm');


describe('npm', function() {
    var npm;
    before(function() {
        npm = new Npm();
    });

    this.timeout(40000);
    it('findUpdated', function(done) {
        npm.findUpdate('2014-02-11T0:24:16.486Z', function(err, docs) {
            done(err);
        });
    });
});