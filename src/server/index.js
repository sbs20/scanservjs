#!/usr/bin/env node
const express = require('express');
const Constants = require('./Constants');

const configurer = require('./Configure');
const app = express();

app.use(express.static('client'));

configurer(app);

app.listen(Constants.Port, () => {
  console.log('listening');
});
