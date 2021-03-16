const fs = require('fs');
const path = require('path');

class UserOptions {
  constructor() {
    const localPath = path.join(__dirname, '../config/config.local.js');
    if (fs.existsSync(localPath)) {
      this.local = require(localPath);
    }
  }

  /**
   * Applies user overrides from config.local.js to the configuration
   * @param {Configuration} config 
   */
  applyToConfig(config) {
    if (this.local && this.local.afterConfig) {
      this.local.afterConfig(config);
    }
  }

  /**
   * Applies user overrides from config.local.js to the devices
   * @param {ScanDevice[]} devices 
   */
  applyToDevices(devices) {
    if (this.local && this.local.afterDevices) {
      this.local.afterDevices(devices);
    }
  }
}

const userOptions = new UserOptions();
module.exports = userOptions;