#!/usr/bin/env node
const express = require('express');
const Config = require('../config/config');
const configurer = require('./Configure');
const log = require('loglevel').getLogger('index');

const app = express();

app.use(express.static('client'));

configurer(app);

app.listen(Config.port, () => {
  log.info('Started');
});
