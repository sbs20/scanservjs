const Config = require('../config/config');
const Device = require('./Device');
const Package = require('../package.json');

const TOOLS = ['scanimage', 'convert'];

class Context {
  static async create() {
    return {
      devices: [await Device.get()],
      version: Package.version,
      tools: TOOLS,
      pipelines: Config.pipelines  
    };
  }
}

module.exports = Context;