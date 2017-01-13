#!/usr/bin/env node

var express = require('express');
var bodyParser = require('body-parser');
var app = express();

var Config = require('./classes/Config');
var Api = require('./classes/Api');

var forbidden = function (req, res) {
    res.status(403).send('<h1>Error 403: Forbidden</h1>');
};

var wrapError = function (err) {
    return {
        message: err.message,
        code: err.code
    };
};

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json());
app.use('/', express.static('.'));

app.get('/node*', forbidden);
app.get('/api.js', forbidden);

app.get('/file', function (req, res) {
    var api = new Api();
    api.fileList().then(function (reply) {
        res.send(reply);
    });
});

app.delete('/file/*', function (req, res) {
    var fullpath = req.params[0];
    var api = new Api();
    api.fileDelete({ data: fullpath}).then(function (reply) {
        res.send(reply);
    });
});

app.get('/ping', function (req, res) {
    res.send('Pong@' + new Date().toISOString());
});

app.post('/convert', function (req, res) {
    var api = new Api();
    api.convert()
        .then(function (fileInfo) {
            fileInfo.content = fileInfo.toBase64();
            res.send(fileInfo);
        })
        .fail(function (data) {
            var err = wrapError(data);
            res.status(500).send(err);
        });
});

app.post('/scan', function (req, res) {
    var param = req.body;
    var api = new Api();
    api.scan(param)
        .then(function (data) {
            res.send(data);
        })
        .fail(function (data) {
            var err = wrapError(data);
            res.status(500).send(err);
        });
});

app.post('/preview', function (req, res) {
    var param = req.body;
    var api = new Api();
    api.preview(param)
        .then(function (data) {
            res.send(data);
        })
        .fail(function (data) {
            var err = wrapError(data);
            res.status(500).send(err);
        });
});

app.get('/diagnostics', function (req, res) {
    var api = new Api();
    api.diagnostics()
        .then(function (tests) {
            res.send(tests);
        });
});

app.listen(Config.Port, function () { console.log('listening'); });