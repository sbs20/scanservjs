const fs = require('fs');
const util = require('util');
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

  async spawn(cmd, stdin) {
    const MAX_BUFFER = 50 * 1024 * 1024;
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

      proc.on('error', (exception) => {
        reject(new Error(`${cmd} error: ${exception.message}, stderr: ${stderr}`));
      });

      proc.on('close', (code) => {
        if (code !== 0) {
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
  }
};

module.exports = System;