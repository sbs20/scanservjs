const fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const Package = require('../package.json');

const System = {
  version: Package.version,

  extend() {
    const t = arguments[0];
    for (let i = 1; i < arguments.length; i++) {
      const s = arguments[i];
      for (const p in s) {
        t[p] = s[p];
      }
    }
    return t;
  },

  fileExists(path) {
    return fs.existsSync(path);
  },

  async execute(cmd) {
    const { stdout } = await exec(cmd);
    return {
      cmd: cmd,
      output: stdout,
      code: 0
    };
  }
};

module.exports = System;