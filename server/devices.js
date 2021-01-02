const log = require('loglevel').getLogger('Devices');
const Config = require('../config/config');
const Device = require('./device');
const FileInfo = require('./file-info');
const Package = require('../package.json');
const Process = require('./process');
const Scanimage = require('./scanimage');

// Relative to execution path
const FILEPATH = './config/devices.json';

class Devices {
  static _parseDevices(s) {
    const deviceIds = [];
    const pattern = /device `?(.*)'.*/g;
    let match;
    while ((match = pattern.exec(s)) !== null) {
      deviceIds.push(match[1]);
    }
    return deviceIds;
  }

  static from(o) {
    if (typeof o === 'object') {
      const devices = [];
      if (Array.isArray(o)) {
        for (let d of o) {
          devices.push(Device.from(d));
        }
      }
      return devices;
    } else {
      throw new Error('Unexpected data for Devices');
    }
  }

  /// Attempts to get a stored configuration of our devices and if
  /// not gets it from the command line.
  static async get() {
    const file = new FileInfo(FILEPATH);
    let devices = null;

    if (file.exists()) {
      devices = Devices.from(file.toJson());
      if (devices.length > 0) {
        if (devices[0].version !== Package.version) {
          log.debug('devices.json version is old. Reloading');
          devices = null;
        }
      } else {
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

      devices = [];
      for (let deviceId of deviceIds) {
        const data = await Process.execute(Scanimage.features(deviceId));
        log.debug('Device features: ', data);
        devices.push(Device.from(data));
      }
      file.save(JSON.stringify(devices, null, 2));
    }

    return devices;
  }

  static reset() {
    const file = new FileInfo(FILEPATH);
    if (file.exists()) {
      file.delete();
    }
  }
}

module.exports = Devices;