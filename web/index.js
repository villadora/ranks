var express = require('express'),
    app = express();

app.use(express.logger());
app.use(app.router);

app.get('/', function(req, res) {
    res.send('Hello world');
});

module.exports = app;
