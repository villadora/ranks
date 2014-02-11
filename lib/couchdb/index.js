var assert = require('assert'),
    _ = require('underscore'),
    util = require('util'),
    url_module = require('url'),
    modified = require('modified'),
    ConfigProto = require('./config'),
    DatabaseProto = require('./db');


function CouchDB(url) {
    this.url = url;
    this.config = Object.create(this);
    _.extend(this.config, ConfigProto);

    this.bindedDBs = {};
}



CouchDB.prototype.bind = function(dbname, options) {
    if (this.hasOwnProperty(dbname) && !this.bindedDBs[dbname]) {
        throw new Error('Invalid dbname for bind: ' + dbname);
    }

    var db = this[dbname] = this.database(dbname, options);

    // bind functions

    this.bindedDBs[dbname] = true;
    return db;
};


CouchDB.prototype.database = function(dbname, options) {
    options = options || {};

    var db = Object.create(this);
    _.extend(db, DatabaseProto);



    db.dbname = dbname;
    return db;
};



// TODO: session manage
CouchDB.prototype.login = function(username, passwd, callback) {

};

CouchDB.prototype.logout = function(callback) {

};

module.exports.CouchDB = CouchDB;



function cachePathMapper(options, callback) {
    // no cache by default
    var url = url_module.parse(options.url || options.uri),
        regexp = /^\/registry\/([a-z-]+)/;
    console.log(url, regexp.test(url.pathname));


    callback(null, path.resolve(__dirname, '../../.npm_cache/cache.json'));
}