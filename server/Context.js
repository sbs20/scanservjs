const Config = require('../config/config');
const Device = require('./Device');
const Package = require('../package.json');

const TOOLS = ['scanimage', 'convert'];

class Context {
  constructor(devices) {
    this.devices = devices;
    this.version = Package.version;
    this.tools = TOOLS;
    this.pipelines = Config.pipelines;
  }

  static async create() {
    return new Context([await Device.get()]);
  }
}

module.exports = Context;