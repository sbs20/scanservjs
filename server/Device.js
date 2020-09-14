const log = require('loglevel').getLogger('Device');

const CmdBuilder = require('./CmdBuilder');
const Config = require('../config/config');
const extend = require('./Util').extend;
const FileInfo = require('./FileInfo');
const Package = require('../package.json');
const Process = require('./Process');

// Relative to execution path
const FILEPATH = './config/devices.json';

const decorate = (device) => {
  for (const key in device.features) {
    let feature = device.features[key];
    let params = null;
    switch (key) {
      case '--mode':
        feature.options = feature.parameters.split('|');
        break;

      case '--resolution':
        feature.options = ['50', '75', '100', '150', '200', '300', '600', '1200'];
        if (feature.parameters.indexOf('|') > -1) {
          feature.options = feature.parameters.replace(/[a-z]/ig, '').split('|');
        } else if (feature.parameters.indexOf('..') > -1) {
          params = feature.parameters.replace(/[a-z]/ig, '').split('..');
          feature.options = [];
          for (let value = Number(params[1]); value > Number(params[0]); value /= 2) {
            feature.options.push(value);
          }
          feature.options.push(Number(params[0]));
          feature.options.sort((a, b) => a - b);
          feature.options = feature.options.map(n => n.toString());
        }
        break;

      case '-l':
      case '-t':
      case '-x':
      case '-y':
        params = feature.parameters.replace(/[a-z]/ig, '').split('..');
        feature.limits = [Math.floor(Number(params[0])), Math.floor(Number(params[1]))];
        feature.default = Math.floor(Number(feature.default));
        break;
      
      case '--brightness':
      case '--contrast':
        params = feature.parameters.split('%')[0].split('..');
        feature.limits = [Number(params[0]), Number(params[1])];
        feature.default = Number(feature.default);
        break;
    }
  }

  return device;
};

// Parses the response of scanimage -A into a dictionary
const parse = (response) => {
  if (response === null || response === '') {
    throw new Error('No device found');
  }

  let device = {
    'name': '',
    'version': Package.version,
    'features': {}
  };

  // find any number of spaces
  // ... match 1 or two hyphens with letters, numbers or hypen
  // find anything
  // ... match anything inside square brackets
  let pattern = /\s+([-]{1,2}[-a-zA-Z0-9]+) ?(.*) \[(.*)\]\n/g;
  let match;
  while ((match = pattern.exec(response)) !== null) {
    if (match[3] !== 'inactive') {
      device.features[match[1]] = {
        'default': match[3],
        'parameters': match[2]
      };  
    }
  }

  pattern = /All options specific to device `(.*)'/;
  match = pattern.exec(response);
  if (match) {
    device.name = match[1];
  }

  if (match === null) {
    throw new Error('Scanimage output contains no matching expressions');
  }

  return device;
};

class Device {
  constructor() {
  }

  static from(o) {
    const device = new Device();
    if (typeof o === 'object') {
      const decorated = decorate(o);
      extend(device, decorated);
      return device;      
    } else if (typeof o === 'string') {
      const data = parse(o);
      return Device.from(data);
    } else {
      throw new Error('Unexpected data for Device');
    }
  }

  /// Attempts to get a stored configuration of our device and if
  /// not gets it from the command line.
  static async get() {
    const file = new FileInfo(FILEPATH);
    let isCached = true;
    if (!file.exists()) {
      log.debug('device.conf does not exist. Reloading');
      isCached = false;
    } else if (Device.from(file.toJson()).version !== Package.version) {
      log.debug('device.conf version is old. Reloading');
      isCached = false;
    }

    if (!isCached) {
      const cmd = new CmdBuilder(Config.scanimage)
        .arg(' -A')
        .build();
  
      const data = await Process.execute(cmd);
      const device = Device.from(data.output);
      file.save(JSON.stringify(device, null, 2));
      return device;
    } else {
      return Device.from(file.toJson());
    }
  }

  static reset() {
    const file = new FileInfo(FILEPATH);
    if (file.exists()) {
      file.delete();
    }
  }

  isFeatureSupported(feature) {
    if (this.features && feature in this.features) {
      return this.features[feature].default !== 'inactive';
    }

    return false;
  }
}

module.exports = Device;