var _ = require('underscore'),
    CouchDB = require('couch-db').CouchDB;

module.exports = Npm;

function Npm(options) {
    this.options = options;
    this.db = new CouchDB("https://registry.npmjs.org/", options);
    this.db.bind('registry');
}


_.extend(Npm.prototype, {
    findUpdate: function(date, callback) {
        if (typeof date == 'function' && arguments.length == 1) {
            callback = date;
            date = undefined;
        }
        date = date || new Date();

        var dateString = (typeof date == 'string') ? date : date.toISOString();

        this.db.registry.view('app/updated', {
            startkey: dateString,
            limit: 10
        }, function(err, docs) {
            console.log(err, docs);
            callback(err, docs);
        });
    }

});
