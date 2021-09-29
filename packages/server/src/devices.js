const log = require('loglevel').getLogger('Devices');
const Config = require('./config');
const Device = require('./device');
const FileInfo = require('./file-info');
const userOptions = require('./user-options');
const Process = require('./process');
const Scanimage = require('./scanimage');
const Util = require('./util');

class Devices {
  static _parseDevices(s) {
    return Util.matchAll(/device `?(.*)'.*/g, s).map(m => m[1]);
  }

  /**
   * @param {ScanDevice[]} o 
   * @returns {ScanDevice[]}
   */
  static from(o) {
    if (typeof o === 'object') {
      try {
        const devices = [];
        if (Array.isArray(o)) {
          for (let d of o) {
            devices.push(Device.from(d));
          }
        }
        return devices;  
      } catch (exception) {
        log.warn(exception);
        return [];
      }
    } else {
      throw new Error('Unexpected data for Devices');
    }
  }

  /**
   * Attempts to get a stored configuration of our devices and if
   * not gets it from the command line.
   * @returns {Promise.<ScanDevice[]>}
   */
  static async get() {
    const file = FileInfo.create(Config.devicesPath);
    let devices = null;

    if (file.exists()) {
      devices = Devices.from(file.parseJson());
      if (devices.length === 0) {
        log.debug('devices.json contains no devices. Reloading');
        devices = null;
      }
    } else {
      log.debug('devices.json does not exist. Reloading');
    }

    if (devices === null) {
      let deviceIds = Config.devices;
      log.debug('Config.devices: ', deviceIds);
      if (Config.devicesFind) {
        const data = await Process.execute(Scanimage.devices());
        log.debug('Device list: ', data);
        const localDevices = Devices._parseDevices(data);
        deviceIds = deviceIds.concat(localDevices);
      }

      /** @type {ScanDevice[]} */
      devices = [];
      for (let deviceId of deviceIds) {
        try {
          const data = await Process.execute(Scanimage.features(deviceId));
          log.debug('Device features: ', data);
          devices.push(Device.from(data));  
        } catch (error) {
          log.error(`Ignoring ${deviceId}. Error: ${error}`);
        }
      }
      file.save(JSON.stringify(devices.map(d => d.string), null, 2));
    }

    userOptions.applyToDevices(devices);
    return devices;
  }

  /**
   * @returns {void}
   */
  static reset() {
    const file = FileInfo.create(Config.devicesPath);
    if (file.exists()) {
      file.delete();
    }
  }
}

module.exports = Devices;