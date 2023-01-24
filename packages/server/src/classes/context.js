const fs = require('fs');

const diagnostic = (path) => {
  const success = fs.existsSync(path) && !fs.statSync(path).isDirectory();
  const message = success ? `Found ${path}` : `Unable to find file ${path}`;
  return {
    success,
    message
  };
};

module.exports = class Context {
  /**
   * @param {Configuration} config
   * @param {ScanDevice[]} devices
   */
  constructor(config, devices) {
    this.devices = devices;
    this.version = config.version;
    this.diagnostics = [
      diagnostic(config.scanimage),
      diagnostic(config.convert)
    ];
    /** @type {Pipeline[]} */
    this.pipelines = config.pipelines;

    /** @type {Filter[]} */
    this.filters = config.filters;

    /** @type {PaperSize[]} */
    this.paperSizes = config.paperSizes;

    /** @type {string[]} */
    this.batchModes = config.batchModes;
  }

  /**
   * @param {string} id
   * @returns {ScanDevice}
   */
  getDevice(id) {
    if (this.devices === undefined || this.devices.length === 0) {
      throw 'No devices found';
    }

    if (id === undefined) {
      return this.devices[0];
    }

    const device = this.devices.filter(device => device.id === id)[0];
    if (device === undefined) {
      throw `Device ${id} not found`;
    }

    return device;
  }
};
