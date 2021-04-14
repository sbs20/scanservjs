const util = require('util');
const log = require('loglevel').getLogger('Process');
const exec = util.promisify(require('child_process').exec);
const spawn = require('child_process').spawn;
const extend = require('./util').extend;

const Process = {
  /**
   * @param {string} cmd 
   * @returns {Promise.<string>}
   */
  async execute(cmd) {
    const { stdout } = await exec(cmd);
    return stdout;
  },

  /**
   * @param {string} cmd 
   * @param {Buffer|null} [stdin] 
   * @param {ProcessOptions} [options] 
   * @return {Promise<Buffer>}
   */
  async spawn(cmd, stdin, options) {
    const MAX_BUFFER = 16 * 1024;
    options = extend({
      encoding: 'binary',
      shell: true,
      maxBuffer: MAX_BUFFER,
      ignoreErrors: false
    }, options);
    
    log.debug(`${cmd}, `, stdin, `, ${JSON.stringify(options)}`);
    return await new Promise((resolve, reject) => {
      let stdout = Buffer.alloc(0);
      let stderr = '';
      const proc = spawn(cmd, [], options);
      proc.stdout.on('data', (data) => {
        stdout = Buffer.concat([stdout, data]);
      });

      proc.stderr.on('data', (data) => {
        stderr += data;
      });

      if (!options.ignoreErrors) {
        proc.on('error', (exception) => {
          reject(new Error(`${cmd} error: ${exception.message}, stderr: ${stderr}`));
        });  
      }

      proc.on('close', (code) => {
        log.trace(`close(${code}): ${cmd}`);
        if (code !== 0 && !options.ignoreErrors) {
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

  /**
   * @param {string[]} cmds 
   * @param {Buffer|null} [stdin] 
   * @param {ProcessOptions} [options] 
   * @return {Promise<Buffer>}
   */
  async chain(cmds, stdin, options) {
    let stdout = null;
    for (let cmd of cmds) {
      stdout = await Process.spawn(cmd, stdin, options);
      stdin = stdout;
    }
    return stdout;
  }
};

module.exports = Process;