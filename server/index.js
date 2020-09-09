#!/usr/bin/env node
const express = require('express');
const Constants = require('./Constants');
const configurer = require('./Configure');
const log = require('loglevel').getLogger('index');

const app = express();

app.use(express.static('client'));

configurer(app);

app.listen(Constants.Port, () => {
  log.info('Started');
});
