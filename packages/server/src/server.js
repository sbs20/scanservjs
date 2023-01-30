#!/usr/bin/env node
const express = require('express');
const application = require('./application');
const configure = require('./configure');
const config = application.config();
const app = express();

app.use(express.static('client'));

configure(app);

const server = app.listen(config.port, config.host, () => {
  const log = require('loglevel').getLogger('server');
  log.info(`scanservjs started listening: https://${config.host}:${config.port}`);
});

server.setTimeout(config.timeout);
