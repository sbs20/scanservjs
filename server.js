#!/usr/bin/env node

var express = require('express');
var bodyParser = require('body-parser');
var app = express();

var Config = require('./classes/Config')
var Api = require('./classes/Api');

var forbidden = function (req, res) {
    res.status(403).send('<h1>Error 403: Forbidden</h1>')
};

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json());
app.use('/', express.static('.'));

app.get('/node*', forbidden);
app.get('/api.js', forbidden);

app.post('/api', function (req, res) {
    var param = req.body;
    var api = new Api();

    api.handleRequest(param).then(function (reply) {
        res.send(reply);
    });
});

app.listen(Config.Port, function () { console.log('listening'); });