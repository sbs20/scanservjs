#!/usr/bin/env node
const { program } = require('commander');
const express = require('express');
const Application = require('./application');
const ExpressConfigurer = require('./express-configurer');

program
  .option('--config <path>', 'Config file path', '/etc/scanservjs/config.local.js')
  .parse(process.argv);

const options = program.opts();

const application = new Application(options.config);
const config = application.config;
const app = express();

ExpressConfigurer.with(app, application)
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
