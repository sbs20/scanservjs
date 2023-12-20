#!/usr/bin/env node
const prod = process.env.NODE_ENV === 'prod' || process.env.NODE_ENV === 'production';

if (!prod && !process.env.SCANSERV_BASE_PATH) {
  process.env.SCANSERV_BASE_PATH = 'data';
}

const { program } = require('commander');
const express = require('express');
const path = require('path');
const Application = require('./application');
const ExpressConfigurer = require('./express-configurer');

program
  .option(
    '--config <path>', 'Config file path',
    prod ? '/etc/scanservjs/config.local.js' : `${path.dirname(__dirname)}/config/config.local.js`
  )
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
