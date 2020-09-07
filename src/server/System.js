const packageJson = require('../../package.json');
const Constants = require('./Constants');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const System = {
  version: packageJson.version,

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

  isArray(obj) {
    return Array.isArray(obj);
  },

  isObject(obj) {
    return obj === Object(obj);
  },

  log(k, v) {
    if (System.isArray(v)) {
      v.forEach((e) => {
        System.trace(k, e);
      });

    } else if (System.isObject(v)) {
      System.trace(k, JSON.stringify(v));

    } else if (v === undefined) {
      console.log(k + Constants.TraceLineEnding);

    } else {
      if (v === null) {
        v = '{NULL}';
      }

      console.log(k + '=' + v + Constants.TraceLineEnding);
    }
  },

  trace(k, v) {
    if (Constants.IsTrace) {
      System.log(k, v);
    }
  },

  async execute(cmd) {
    const { stdout } = await exec(cmd);
    return {
      cmd: cmd,
      output: stdout,
      code: 0
    };
  },

  error(e) {
    System.log('Error', e);
  },

  async scannerDevices() {
    const cmd = Constants.Scanimage + ' -L';
    return await System.execute(cmd);
  }
};

module.exports = System;