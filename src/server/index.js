#!/usr/bin/env node
const express = require('express');
const Constants = require('./Constants');

const configurer = require('./Configure');
const app = express();
configurer(app);

app.listen(Constants.Port, () => {
  console.log('listening');
});
