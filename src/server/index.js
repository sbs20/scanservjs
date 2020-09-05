#!/usr/bin/env node
const express = require('express');
const configurer = require('./Configure');
const Config = require('./classes/Config');

const app = express();
configurer(app);

app.listen(Config.Port, () => {
  console.log('listening');
});
