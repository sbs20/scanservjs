const Constants = require('../constants');

class BatchMode {
  /**
   * @param {string} value
   */
  constructor(value) {
    this.isAuto = [Constants.BATCH_NONE, Constants.BATCH_MANUAL]
      .every(v => value !== v);
  }

  /**
   * @param {string} value
   */
  static from(value) {
    return new BatchMode(value);
  }
}

class Source {
  /**
   * @param {string} value
   */
  constructor(value) {
    this.isAdf = [
      'adf',
      'document feeder'
    ].some(v => value.toLowerCase().includes(v));
  }

  /**
   * @param {string} value
   */
  static from(value) {
    return new Source(value);
  }
}

module.exports = class SourceInfo {
  constructor(device) {
    if (device.features['--source']) {
      Object.assign(this, device.features['--source'].options.reduce((acc, option) => {
        const isAdf = Source.from(option).isAdf;
        const batchModes = device.settings.batchMode.options
          .filter(b => BatchMode.from(b).isAuto === isAdf);
        acc[option] = { isAdf, batchModes };
        return acc;
      }, {}));
    }
  }
};
