#!/usr/bin/env node
var express = require('express');
var configurer = require('./Configure');
var Config = require('./classes/Config');

var app = express();
configurer(app);

app.listen(Config.Port, function () {
    console.log('listening');
});
