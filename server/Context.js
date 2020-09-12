const fs = require('fs');
const Config = require('../config/config');
const Device = require('./Device');
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
  constructor(devices) {
    this.devices = devices;
    this.version = Package.version;
    this.diagnostics = [
      diagnostic(Config.scanimage),
      diagnostic(Config.convert)
    ];
    this.pipelines = Config.pipelines;
  }

  static async create() {
    const devices = [await Device.get()];
    return new Context(devices);
  }
}

module.exports = Context;