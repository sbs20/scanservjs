const prefix = require('loglevel-plugin-prefix');
const rootLog = require('loglevel');
const Config = require('./classes/config');
const Context = require('./classes/context');
const DeviceIdParser = require('./classes/device-id-parser');
const Device = require('./classes/device');
const FileInfo = require('./classes/file-info');
const FilterBuilder = require('./classes/filter-builder');
const ScanimageCommand = require('./classes/scanimage-command');
const System = require('./classes/system');
const UserOptions = require('./classes/user-options');

module.exports = class Application {
  constructor(configPath) {
    this.userOptions = new UserOptions(configPath);
    this.config = new Config(this.userOptions);

    // We need to apply logging setting prior to anything else using a logger
    prefix.reg(rootLog);
    rootLog.enableAll();
    rootLog.setLevel(this.config.log.level);
    prefix.apply(rootLog, this.config.log.prefix);

    this.log = rootLog.getLogger('Application');
    this.scanimageCommand = new ScanimageCommand(this.config);
  }

  /**
   * Attempts to get a stored configuration of our devices and if
   * not gets it from the command line.
   * @returns {Promise.<ScanDevice[]>}
   */
  async deviceList() {
    const Process = require('./classes/process');
    const file = FileInfo.create(this.config.devicesPath);
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
          this.log.warn(exception);
          devices = [];
        }
      } else {
        throw new Error('Unexpected data for Devices');
      }

      if (devices.length === 0) {
        this.log.debug('devices.json contains no devices. Reloading');
        devices = null;
      }
    } else {
      this.log.info('devices.json does not exist. Reloading');
    }

    if (devices === null) {
      let deviceIds = this.config.devices;
      this.log.debug({'Config.devices': deviceIds});
      if (this.config.devicesFind) {
        const data = await Process.execute(this.scanimageCommand.devices());
        this.log.debug({'devices': data});
        const localDevices = new DeviceIdParser(data).ids();
        deviceIds = deviceIds.concat(localDevices);
      }

      /** @type {ScanDevice[]} */
      devices = [];
      for (let deviceId of deviceIds) {
        try {
          const data = await Process.execute(this.scanimageCommand.features(deviceId));
          this.log.debug(`features: ${data}`);
          devices.push(Device.from(data));
        } catch (error) {
          this.log.error(`Ignoring ${deviceId}. Error: ${error}`);
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
    const file = FileInfo.create(this.config.devicesPath);
    if (file.exists()) {
      file.delete();
    }
  }

  /**
   * @returns {Promise.<Context>}
   */
  async context() {
    const devices = await this.deviceList();
    return new Context(this.config, devices, this.userOptions);
  }

  async systemInfo() {
    return await System.info();
  }

  filterBuilder() {
    return new FilterBuilder(this.config);
  }
};
