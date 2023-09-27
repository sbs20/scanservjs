#!/usr/bin/env node
const express = require('express');
const application = require('./application');
const config = application.config();
const app = express();
const ExpressConfigurer = require('./express-configurer');

ExpressConfigurer.with(app)
  .encoding()
  .statics()
  .basicAuth()
  .swagger()
  .endpoints();

const server = app.listen(config.port, config.host, () => {
  const log = require('loglevel').getLogger('server');
  log.info(`scanservjs started listening: https://${config.host}:${config.port}`);
});

server.setTimeout(config.timeout);
