var neo4j = require('neoj4'), 
    LRU = require('lru-cache'),
    conns = LRU({
        max:20, 
        length: function(n)  {return 1; },
        dispose: function(key, conn) { },
        maxAge: 1000 * 60 * 60 * 6
    });

module.exports.init = function(opts) {
    this.neo4jUrl = opts.url || this.neo4jUrl || 'http://localhost:7474';
};

module.exports.create = function() {

};

module.exports.save = function() {

};
