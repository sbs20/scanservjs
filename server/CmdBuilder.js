const log = require('loglevel').getLogger('CmdBuilder');

class CmdBuilder {
  constructor(cmd) {
    this.cmd = cmd;
  }

  arg(key, value) {
    this.cmd += ` ${key}`;

    if (value !== undefined) {
      if (typeof value === 'string') {
        this.cmd += ` "${value}"`;
      } else {
        this.cmd += ` ${value}`;
      }
    }
    return this;
  }

  pipe() {
    this.cmd += ' |';
    return this;
  }

  redirect() {
    this.cmd += ' >';
    return this;
  }

  build() {
    log.debug('build()', this.cmd);
    return this.cmd;
  }
}

module.exports = CmdBuilder;