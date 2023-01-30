const util = require('util');

module.exports = class LogFormatter {
  full(o) {
    return util.inspect(o, {
      showHidden: false,
      depth: null,
      colors: true
    });
  }

  static format() {
    return new LogFormatter();
  }
};
