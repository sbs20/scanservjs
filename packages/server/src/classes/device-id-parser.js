const Regex = require('./regex');

module.exports = class DeviceIdParser {
  constructor(data) {
    this.data = data;
  }

  /**
   * @returns {string[]}
   */
  ids() {
    return Regex.with(/device `?(.*)'.*/g)
      .matchAll(this.data)
      .map(m => m[1]);
  }
};
