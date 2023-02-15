const fs = require('fs');
const objectMerger = require('./object-merger');

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
   * @param {UserOptions} userOptions
   */
  constructor(config, devices, userOptions) {
    if (!config) {
      throw new Error('config is null or undefined');
    }

    if (!devices) {
      throw new Error('devices is null or undefined');
    }

    if (!userOptions) {
      throw new Error('userOptions is null or undefined');
    }

    const defaultSettings = () => {
      return {
        batchMode: {
          options: config.batchModes,
          default: config.batchModes[0]
        },
        filters: {
          options: config.filters.map(f => f.description),
          default: []
        },
        pipeline: {
          options: config.pipelines.map(p => p.description),
          default: config.pipelines[0].description
        }
      };
    };

    // Add defaults for all existing devices - useful for user configuration
    devices.forEach(device => {
      device.settings = defaultSettings();
    });

    userOptions.afterDevices(devices);

    // Re-add defaults in case user adds new devices
    devices.forEach(device => {
      device.settings = objectMerger.deepMerge({}, defaultSettings(), device.settings);
    });

    this.devices = devices;
    this.version = config.version;
    this.diagnostics = [
      diagnostic(config.scanimage),
      diagnostic(config.convert)
    ];

    /** @type {PaperSize[]} */
    this.paperSizes = config.paperSizes;

    /** @type {string[]} */
    this.actions = userOptions.actions().map(a => a.name);
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
