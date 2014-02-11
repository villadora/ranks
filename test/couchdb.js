var assert = require('chai').assert,
    couchdb = require('../lib/couchdb'),
    CouchDB = couchdb.CouchDB;


describe('couchdb', function() {
    this.timeout(30000);

    var db;

    before(function() {
        db = new CouchDB('http://isaacs.iriscouch.com/');
        db = new CouchDB('https://skimdb.npmjs.com/');
        db.bind('registry');
    });


    describe('registry', function() {
        it('info', function(done) {
            db.registry.info(function(err, info) {
                done(err);
            });
        });

        it('alldoc', function(done) {
            db.registry.allDoc('0', '1', function(err, docs, total, offset) {
                assert
                done(err);
            });
        });

        it.only('get', function(done) {
            db.registry.get('not', function(err, doc) {
                console.log(err, doc);
                done(err);
            });
        });
    });
});