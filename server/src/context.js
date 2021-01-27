const fs = require('fs');
const Config = require('../config/config');
const Devices = require('./devices');
const Package = require('../package.json');

const diagnostic = (path) => {
  const success = fs.existsSync(path);
  const message = success ? `Found ${path}` : `Unable to find ${path}`;
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
    this.version = Package.version;
    this.diagnostics = [
      diagnostic(Config.scanimage),
      diagnostic(Config.convert)
    ];
    /** @type {Pipeline[]} */
    this.pipelines = Config.pipelines;
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
    return id
      ? this.devices.filter(device => device.id === id)[0]
      : this.devices[0];
  }
}

module.exports = Context;