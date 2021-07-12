const extend = require('./util').extend;

/**
 * @param {number} n 
 * @returns {number}
 */
function round(n) {
  return Math.floor(n * 10) / 10;
}

class Feature {
  /**
   * @param {string} string 
   * @param {string} delimiter
   * @returns {number[]} 
   */
  static splitNumbers(string, delimiter) {
    return string.replace(/[a-z%]/ig, '')
      .split(delimiter)
      .filter(s => s.length > 0)
      .map(s => Number(s));
  }

  /**
   * @param {ScanDeviceFeature} feature 
   */
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

  /**
   * @param {ScanDeviceFeature} feature 
   */
  static range(feature) {
    feature.default = round(Number(feature.default));
    const range = /(.*?)(?:\s|$)/g.exec(feature.parameters);
    feature.limits = Feature.splitNumbers(range[1], '..');
    const steps = /\(in steps of ([0-9]{1,2})\)/g.exec(feature.parameters);
    feature.interval = steps ? Number(steps[1]) : 1;
  }

  /**
   * @param {ScanDeviceFeature} feature 
   */
  static geometry(feature) {
    Feature.range(feature);
    feature.limits[0] = round(feature.limits[0]);
    feature.limits[1] = round(feature.limits[1]);
  }

  /**
   * @param {ScanDeviceFeature} feature 
   */
  static lighting(feature) {
    Feature.range(feature);
  }
}

class Adapter {
  /**
   * @param {ScanDevice} device 
   * @returns {ScanDevice}
   */
  static decorate(device) {
    device.name = device.id;
    for (const key in device.features) {
      const feature = device.features[key];
      feature.parameters = feature.parameters.replace(/^auto\|/, '');
      switch (key) {
        case '--mode':
        case '--source':
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
  
  /**
   * Parses the response of scanimage -A into a dictionary
   * @param {string} response 
   * @returns {ScanDevice}
   */
  static parse(response) {
    if (response === null || response === '') {
      throw new Error('No device found');
    }
  
    /** @type {ScanDevice} */
    let device = {
      'id': '',
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
      if (!['inactive', 'read-only'].includes(match[3])) {
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

  validate() {
    const mandatory = ['--resolution', '-l', '-t', '-x', '-y'];
    for (const feature of mandatory) {
      if (this.features[feature] === undefined) {
        throw `${feature} is missing from device`;
      }
    }
  }

  /**
   * @param {any|string} o
   * @returns {ScanDevice}
   */
  static from(o) {
    const device = new Device();
    if (typeof o === 'object') {
      const decorated = Adapter.decorate(o);
      extend(device, decorated);
      device.validate();
      return device;      
    } else if (typeof o === 'string') {
      const data = Adapter.parse(o);
      return Device.from(data);
    } else {
      throw new Error('Unexpected data for Device');
    }
  }
}

module.exports = Device;