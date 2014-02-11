var _ = require('underscore'),
    path = require('path'),
    qs = require('querystring'),
    url_module = require('url');



module.exports = {
    info: function(callback) {
        this._request(url_module.resolve(this.url, this.dbname), 'GET', function(err, body) {
            callback(err, body);
        });
    },
    allDoc: function(startkey, endkey, callback) {
        if (typeof startkey == 'string')
            startkey = '"' + startkey + '"';

        if (typeof endkey == 'string')
            endkey = '"' + endkey + '"';


        var url = url_module.resolve(this.url, this.dbname) + '/_all_docs?' + qs.stringify({
            'startkey': startkey || null,
            'endkey': endkey || null
        });

        this._request(url, 'GET', function(err, body) {
            if (err) return callback(err);

            callback(err, body.rows, body.total_rows, body.offset);
        });
    },
    get: function(docid, query, callback) {
        if (!callback && typeof query == 'function')
            callback = query, query = {};

        if (docid === null || docid === undefined)
            return callback(new Error("docid must be provided"));

        var url = url_module.resolve(this.url, this.dbname) + '/' + docid + '?' + qs.stringify(query || {});

        this._request(url, 'GET', function(err, body) {
            callback(err, body);
        });
    },
    del: function(callback) {

    },
    init: function(callback) {
        var url = url_module.resolve(this.url, this.dbname);
        this._request(url, 'PUT', function(err, body) {
            if (body && body.error) {
                callback(err || body.reason);
            } else
                callback(err, body);
        });
    },
    _request: function(url, method, callback) {
        if (!this.request) {
            this.request = require('request');
        }

        // if(callback)
        request({
            url: url,
            method: method,
            json: true
        }, function(err, res, body) {
            if (res.statusCode < 400) {
                callback(err, body, res);
            } else {
                callback(err || res.statusCode, null, body, res);
            }
        });
    }
};