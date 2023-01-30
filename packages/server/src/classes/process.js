const util = require('util');
const exec = util.promisify(require('child_process').exec);
const execSync = require('child_process').execSync;
const spawn = require('child_process').spawn;

module.exports = new class Process {

  /**
   * @returns {log.Logger}
   */
  log() {
    if (!this._log) {
      this._log = require('loglevel').getLogger('Process');
    }
    return this._log;
  }

  /**
   * @param {string} cmd
   * @returns {string}
   */
  executeSync(cmd, options) {
    const stdout = execSync(cmd, options);
    return Buffer.from(stdout).toString().trim();
  }

  /**
   * @param {string} cmd
   * @returns {Promise.<string>}
   */
  async execute(cmd) {
    this.log().info({execute: cmd});
    const { stdout } = await exec(cmd);
    return stdout;
  }

  /**
   * @param {string} cmd
   * @param {Buffer|null} [stdin]
   * @param {ProcessOptions} [options]
   * @return {Promise<Buffer>}
   */
  async spawn(cmd, stdin, options) {
    const MAX_BUFFER = 16 * 1024;
    options = Object.assign({
      encoding: 'binary',
      shell: true,
      maxBuffer: MAX_BUFFER,
      ignoreErrors: false
    }, options);

    if (this.log().getLevel() > this.log().levels.DEBUG) {
      this.log().info({spawn: cmd});
    } else {
      this.log().debug({
        spawn: {
          cmd,
          stdin,
          options
        }
      });
    }

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
        this.log().trace(`close(${code}): ${cmd}`);
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
  }

  /**
   * @param {string[]} cmds
   * @param {Buffer|null} [stdin]
   * @param {ProcessOptions} [options]
   * @return {Promise<Buffer>}
   */
  async chain(cmds, stdin, options) {
    let stdout = null;
    for (let cmd of cmds) {
      stdout = await this.spawn(cmd, stdin, options);
      stdin = stdout;
    }
    return stdout;
  }
};
