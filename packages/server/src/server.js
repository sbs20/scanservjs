#!/usr/bin/env node
const express = require('express');
const Config = require('./config');
const configure = require('./configure');
const log = require('loglevel').getLogger('server');

const app = express();

app.use(express.static('client'));

configure(app);

const server = app.listen(Config.port, () => {
  log.info('Started');
});

server.setTimeout(Config.timeout);
