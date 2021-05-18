const os = require('os');
const Process = require('./process');

class System {
  /**
   * @returns {Promise.<SystemInfo>}
   */
  static async info() {
    const info = {
      os: {
        arch: os.arch(),
        freemem: Math.floor(os.freemem() / (1024 * 1024)),
        platform: os.platform(),
        release: os.release(),
        type: os.type()
      },
      node: process.version,
      npm: (await Process.spawn('npm -v')).toString().trim(),
      docker: (await Process.spawn(
        'grep -s \'docker\\|lxc\' /proc/1/cgroup',
        undefined,
        { ignoreErrors: true } )).length > 0
    };

    try {
      info.os.version = os.version();
    } catch (e) {
      info.os.version = 'Unavailable';
    }

    return info;
  }
}

module.exports = System;