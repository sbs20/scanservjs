const Config = require('./classes/config');
const Context = require('./classes/context');
const DeviceIdParser = require('./classes/device-id-parser');
const Device = require('./classes/device');
const FileInfo = require('./classes/file-info');
const FilterBuilder = require('./classes/filter-builder');
const System = require('./classes/system');
const UserOptions = require('./classes/user-options');

module.exports = new class Application {
  constructor() {
    this._userOptions = null;
    /** @type {Configuration} */
    this._config = null;
    /** @type {ScanimageCommand} */
    this._scanimageCommand = null;
  }

  userOptions() {
    if (this._userOptions === null) {
      this._userOptions = new UserOptions('../../config/config.local.js');
    }
    return this._userOptions;
  }

  /**
   * @returns {Configuration}
   */
  config() {
    if (this._config === null) {
      this._config = new Config(this.userOptions());
    }
    return this._config;
  }

  scanimageCommand() {
    if (this._scanimageCommand === null) {
      const ScanimageCommand = require('./classes/scanimage-command');
      this._scanimageCommand = new ScanimageCommand(this.config());
    }
    return this._scanimageCommand;
  }

  /**
   * Attempts to get a stored configuration of our devices and if
   * not gets it from the command line.
   * @returns {Promise.<ScanDevice[]>}
   */
  async deviceList() {
    const log = require('loglevel').getLogger('Application');
    const Process = require('./classes/process');
    const config = this.config();
    const scanimageCommand = this.scanimageCommand();
    const file = FileInfo.create(config.devicesPath);
    let devices = null;

    if (file.exists()) {
      const o = file.parseJson();
      if (typeof o === 'object') {
        try {
          devices = [];
          if (Array.isArray(o)) {
            for (let d of o) {
              devices.push(Device.from(d));
            }
          }
        } catch (exception) {
          log.warn(exception);
          devices = [];
        }
      } else {
        throw new Error('Unexpected data for Devices');
      }

      if (devices.length === 0) {
        log.debug('devices.json contains no devices. Reloading');
        devices = null;
      }
    } else {
      log.debug('devices.json does not exist. Reloading');
    }

    if (devices === null) {
      let deviceIds = config.devices;
      log.debug('Config.devices: ', deviceIds);
      if (config.devicesFind) {
        const data = await Process.execute(scanimageCommand.devices());
        log.debug('Device list: ', data);
        const localDevices = new DeviceIdParser(data).ids();
        deviceIds = deviceIds.concat(localDevices);
      }

      /** @type {ScanDevice[]} */
      devices = [];
      for (let deviceId of deviceIds) {
        try {
          const data = await Process.execute(scanimageCommand.features(deviceId));
          log.debug('Device features: ', data);
          devices.push(Device.from(data));
        } catch (error) {
          log.error(`Ignoring ${deviceId}. Error: ${error}`);
        }
      }
      file.save(JSON.stringify(devices.map(d => d.string), null, 2));
    }

    return devices;
  }

  /**
   * @returns {void}
   */
  deviceReset() {
    const file = FileInfo.create(this.config().devicesPath);
    if (file.exists()) {
      file.delete();
    }
  }

  /**
   * @returns {Promise.<Context>}
   */
  async context() {
    const devices = await this.deviceList();
    return new Context(this.config(), devices, this.userOptions());
  }

  system() {
    return new System();
  }

  filterBuilder() {
    return new FilterBuilder(this.config());
  }
};
