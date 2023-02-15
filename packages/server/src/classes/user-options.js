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

  /**
   * Returns a list of all the actions
   * @returns {Action[]}
   */
  actions() {
    return this.local && this.local.actions && Array.isArray(this.local.actions)
      ? this.local.actions
      : [];
  }

  /**
   * Returns a named action
   * @param {string} actionName
   * @returns {Action}
   */
  action(actionName) {
    const matches = this.actions().filter(a => a.name === actionName);
    if (matches.length === 0) {
      throw new Error(`No matching action: '${actionName}'`);
    } else if (matches.length > 1) {
      throw new Error(`Multiple matching actions: '${actionName}'`);
    }
    const action = matches[0];
    if (!('execute' in action)) {
      throw new Error(`Action '${actionName}' has no execute method`);
    }
    if (!(action.execute instanceof Function)) {
      throw new Error(`${actionName}.execute() is not a function`);
    }
    return action;
  }
};
