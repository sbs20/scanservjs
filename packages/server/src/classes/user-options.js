const fs = require('fs');
const path = require('path');

module.exports = class UserOptions {
  constructor(localConfigPath) {
    if (localConfigPath) {
      const localPath = path.join(__dirname, localConfigPath);
      if (fs.existsSync(localPath)) {
        this.local = require(localPath);
      }
    }
  }

  /**
   * Passes a config reference to config.local.js for customisation
   * @param {Configuration} config
   */
  afterConfig(config) {
    if (this.local && this.local.afterConfig) {
      this.local.afterConfig(config);
    }
  }

  /**
   * Passes a devices reference to config.local.js for customisation
   * @param {ScanDevice[]} devices
   */
  afterDevices(devices) {
    if (this.local && this.local.afterDevices) {
      this.local.afterDevices(devices);
    }
  }

  /**
   * Passes a fileInfo of the scan result to config.local.js
   * @param {FileInfo} fileInfo
   * @returns {Promise.<any>}
   */
  async afterScan(fileInfo) {
    if (this.local && this.local.afterScan) {
      return await this.local.afterScan(fileInfo);
    }
  }
};
