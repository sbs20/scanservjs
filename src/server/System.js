const packageJson = require('../../package.json');
const Constants = require('./Constants');
const exec = require('child_process').exec;

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
    const result = {
      cmd: cmd,
      output: '',
      code: -1
    };

    return await new Promise((resolve, reject) => {
      if (!Constants.BypassSystemExecute) {
        System.trace('System.execute:start', cmd);
  
        exec(cmd, (error, stdout) => {
          if (error) {
            System.trace('System.execute:error', result);
            reject(error);
          }
  
          System.extend(result, {
            output: stdout,
            code: error ? -1 : 0
          });
  
          System.trace('System.execute:finish', result);
          resolve(result);
        });
      }
    });
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