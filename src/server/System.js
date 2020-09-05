const packageJson = require('../../package.json');
const config = require('./Config');
const exec = require('child_process').exec;
const Q = require('kew');

const System = {
  version: packageJson.version,

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
      console.log(k + config.TraceLineEnding);

    } else {
      if (v === null) {
        v = '{NULL}';
      }

      console.log(k + '=' + v + config.TraceLineEnding);
    }
  },

  trace(k, v) {
    if (config.IsTrace) {
      System.log(k, v);
    }
  },

  execute(cmd) {
    const deferred = Q.defer();

    const res = {
      cmd: cmd,
      output: '',
      code: -1
    };

    if (!config.BypassSystemExecute) {
      System.trace('System.execute:start', cmd);

      exec(cmd, (error, stdout) => {
        if (error) {
          deferred.reject(error);
          return;
        }

        System.extend(res, {
          output: stdout,
          code: error ? -1 : 0
        });

        System.trace('System.execute:finish', res);

        deferred.resolve(res);
      });
    }

    return deferred.promise;
  },

  error(e) {
    System.log('Error', e);
  },

  scannerDevices() {
    const cmd = config.Scanimage + ' -L';
    return System.execute(cmd);
  },

  extend() {
    const t = arguments[0];
    for (let i = 1; i < arguments.length; i++) {
      const s = arguments[i];
      for (const p in s) {
        t[p] = s[p];
      }
    }
    return t;
  }
};

module.exports = System;