const fs = require('fs');
const Config = require('./config');
const Devices = require('./devices');

const diagnostic = (path) => {
  const success = fs.existsSync(path) && !fs.statSync(path).isDirectory();
  const message = success ? `Found ${path}` : `Unable to find file ${path}`;
  return {
    success,
    message
  };
};

class Context {
  /**
   * @param {ScanDevice[]} devices 
   */
  constructor(devices) {
    this.devices = devices;
    this.version = Config.version;
    this.diagnostics = [
      diagnostic(Config.scanimage),
      diagnostic(Config.convert)
    ];
    /** @type {Pipeline[]} */
    this.pipelines = Config.pipelines;

    /** @type {Filter[]} */
    this.filters = Config.filters;

    /** @type {PaperSize[]} */
    this.paperSizes = Config.paperSizes;

    /** @type {string[]} */
    this.batchModes = Config.batchModes;
  }

  /**
   * @returns {Promise.<Context>}
   */
  static async create() {
    const devices = await Devices.get();
    return new Context(devices);
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
}

module.exports = Context;