const os = require('os');
const Process = require('./process');

class System {
  /**
   * @returns {Promise.<SystemInfo>}
   */
  static async info() {
    const output = {
      os: {
        arch: os.arch(),
        freemem: Math.floor(os.freemem() / (1024 * 1024)),
        platform: os.platform(),
        release: os.release(),
        type: os.type(),
        version: os.version()
      },
      node: process.version,
      npm: (await Process.spawn('npm -v')).toString().trim(),
      docker: (await Process.spawn(
        'grep -sq \'docker\\|lxc\' /proc/1/cgroup',
        undefined,
        { ignoreErrors: true } )).length > 0
    }

    return output;
  }
}

module.exports = System;