const log = require('loglevel').getLogger('CmdBuilder');

module.exports = class CommandBuilder {

  /**
   * @param {string} cmd
   */
  constructor(cmd) {
    this.cmd = cmd;
    this.args = [];
  }

  /**
   * @param {string|number} [value]
   * @returns {string}
   */
  _format(value) {
    if (['boolean', 'number'].includes(typeof value)) {
      return `${value}`;
    } else if ('string' === typeof value) {
      if (value.includes('\'')) {
        throw Error('Argument must not contain single quote "\'"');
      } else if (/^[0-9a-z-=/~.:]+$/i.test(value)) {
        return `${value}`;
      }
      return `'${value}'`;
    }
    throw Error(`Invalid argument type: '${typeof value}'`);
  }

  /**
   * @param {Array<string|number>} values
   * @returns {CmdBuilder}
   */
  arg(...values) {
    this.args.push(...values
      .filter(s => s !== undefined)
      .map(this._format));
    return this;
  }

  /**
   * Use for arguments requiring key=value. Using `arg(...)` doesn't work:
   *
   * ```js
   *   .arg('-key', 'value') // becomes "-key value"
   *   .arg('-key=value') // becomes "'-key=value'"
   * ```
   *
   * Both of these results are incorrect and fail to work.
   *
   * This method provides a solution so that
   *
   * ```js
   *   .argPair('-key', 'value') // becomes "-key='value'"
   * ```
   * @param {string} key
   * @param {string} value
   */
  argPair(key, value) {
    const arg = `${this._format(key)}=${this._format(value)}`;
    this.args.push(arg);
    return this;
  }

  /**
   * @param {string} operator
   * @returns {CmdBuilder}
   */
  redirect(operator) {
    if (typeof operator !== 'string' || !/^[&<>|]+$/.test(operator)) {
      throw Error(`Invalid argument: '${operator}'`);
    }
    this.args.push(operator);
    return this;
  }

  /**
   * @param {boolean} [ignoreStderr]
   * @returns {string}
   */
  build(ignoreStderr) {
    log.trace('build()', this);
    let cmd = this.cmd;
    for (const arg of this.args) {
      cmd += ' ' + arg;
    }
    if (ignoreStderr) {
      cmd += ' 2>/dev/null';
    }
    log.trace('build()', cmd);
    return cmd;
  }
};
