const fs = require('fs');
const util = require('util');
const log = require('loglevel').getLogger('System');
const exec = util.promisify(require('child_process').exec);
const spawn = require('child_process').spawn;

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
  },

  async spawn(cmd, stdin, ignoreErrors) {
    const MAX_BUFFER = 50 * 1024 * 1024;
    ignoreErrors = ignoreErrors === undefined ? false : true;
    log.debug(cmd, stdin, ignoreErrors);
    return await new Promise((resolve, reject) => {
      let stdout = Buffer.alloc(0);
      let stderr = '';
      const proc = spawn(cmd, null, {
        encoding: 'binary',
        shell: true,
        maxBuffer: MAX_BUFFER
      });

      proc.stdout.on('data', (data) => {
        stdout = Buffer.concat([stdout, data]);
      });

      proc.stderr.on('data', (data) => {
        stderr += data;
      });

      if (!ignoreErrors) {
        proc.on('error', (exception) => {
          reject(new Error(`${cmd} error: ${exception.message}, stderr: ${stderr}`));
        });  
      }

      proc.on('close', (code) => {
        log.debug(`close(${code}): ${cmd}`);
        if (code !== 0 && !ignoreErrors) {
          reject(new Error(`${cmd} exited with code: ${code}, stderr: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });

      if (stdin) {
        proc.stdin.write(stdin);
        proc.stdin.end();  
      }
    });
  },

  async pipe(cmdArray, stdin, ignoreErrors) {
    let stdout = null;
    for (let cmd of cmdArray) {
      stdout = await System.spawn(cmd, stdin, ignoreErrors);
      stdin = stdout;
    }
    return stdout;
  }
};

module.exports = System;