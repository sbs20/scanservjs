#!/usr/bin/env node
var app = express();

var Config = require('./classes/Config');

app.listen(Config.Port, function () {
    console.log('listening');
});
