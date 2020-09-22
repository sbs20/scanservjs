const log = require('loglevel').getLogger('CmdBuilder');

class CmdBuilder {
  constructor(cmd) {
    this.cmd = cmd;
    this.args = [];
  }

  arg(key, value) {
    this.args.push(key);
    if (value !== undefined) {
      if (typeof value === 'string') {
        if (value.includes('\'')) {
          throw Error('Argument must not contain single quote "\'"');
        }
        this.args.push(`'${value}'`);
      } else {
        this.args.push(`${value}`);
      }
    }
    return this;
  }

  build(ignoreStderr) {
    log.trace('build()', this);
    let cmd = this.cmd;
    for (const arg of this.args) {
      cmd += ' ' + arg;
    }
    if (ignoreStderr) {
      cmd += ' 2>/dev/null';
    }
    log.debug('build()', cmd);
    return cmd;
  }
}

module.exports = CmdBuilder;