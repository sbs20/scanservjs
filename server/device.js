const log = require('loglevel').getLogger('Device');

const extend = require('./util').extend;
const FileInfo = require('./file-info');
const Package = require('../package.json');
const Process = require('./process');
const Scanimage = require('./scanimage');

// Relative to execution path
const FILEPATH = './config/devices.json';

class Feature {
  static splitNumbers(string, delimiter) {
    return string.replace(/[a-z%]/ig, '')
      .split(delimiter)
      .map(s => Number(s));
  }

  static resolution(feature) {
    feature.options = [50, 75, 100, 150, 200, 300, 600, 1200];
    if (feature.parameters.indexOf('|') > -1) {
      feature.options = Feature.splitNumbers(feature.parameters, '|');
    } else if (feature.parameters.indexOf('..') > -1) {
      const limits = Feature.splitNumbers(feature.parameters, '..');
      feature.options = [];
      for (let value = limits[1]; value > limits[0]; value /= 2) {
        feature.options.push(value);
      }
      feature.options.push(limits[0]);
      feature.options.sort((a, b) => a - b);
    }
    feature.default = Number(feature.default);
  }

  static range(feature) {
    feature.default = Math.floor(Number(feature.default));
    const range = /(.*?)(?:\s|$)/g.exec(feature.parameters);
    feature.limits = Feature.splitNumbers(range[1], '..');
    const steps = /\(in steps of ([0-9]{1,2})\)/g.exec(feature.parameters);
    feature.interval = steps ? Number(steps[1]) : 1;
  }

  static geometry(feature) {
    Feature.range(feature);
    feature.limits[0] = Math.floor(feature.limits[0]);
    feature.limits[1] = Math.floor(feature.limits[1]);
  }

  static lighting(feature) {
    Feature.range(feature);
  }
}

class Adapter {
  static decorate(device) {
    for (const key in device.features) {
      const feature = device.features[key];
      switch (key) {
        case '--mode':
          feature.options = feature.parameters.split('|');
          break;
  
        case '--resolution':
          Feature.resolution(feature);
          break;
  
        case '-l':
        case '-t':
        case '-x':
        case '-y':
          Feature.geometry(feature);
          break;
        
        case '--brightness':
        case '--contrast':
          Feature.lighting(feature);
          break;
      }
    }
  
    return device;
  }
  
  // Parses the response of scanimage -A into a dictionary
  static parse(response) {
    if (response === null || response === '') {
      throw new Error('No device found');
    }
  
    let device = {
      'id': '',
      'version': Package.version,
      'features': {}
    };
  
    // find
    //   any number of spaces
    //   match 1 or two hyphens with letters, numbers or hypen
    //   match anything (until square brackets)
    //   match anything inside square brackets
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
      device.id = match[1];
    }
  
    if (match === null) {
      throw new Error('Scanimage output contains no matching expressions');
    }
  
    return device;
  }
}

class Device {
  constructor() {
  }

  static from(o) {
    const device = new Device();
    if (typeof o === 'object') {
      const decorated = Adapter.decorate(o);
      extend(device, decorated);
      return device;      
    } else if (typeof o === 'string') {
      const data = Adapter.parse(o);
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
      const data = await Process.execute(Scanimage.all());
      const device = Device.from(data);
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
}

module.exports = Device;