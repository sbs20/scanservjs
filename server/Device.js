const log = require('loglevel').getLogger('Device');

const CmdBuilder = require('./CmdBuilder');
const Constants = require('./Constants');
const System = require('./System');
const FileInfo = require('./FileInfo');

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
          feature.options = feature.parameters.split('|');
        }
        break;

      case '-l':
      case '-t':
      case '-x':
      case '-y':
        params = feature.parameters.replace(/[a-z]/ig, '').split('..');
        feature.limits = [Number(params[0]), Number(params[1])];
        feature.default = Number(feature.default);
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

/// Parses the response of scanimage -A into a dictionary
const parse = (response) => {
  if (response === null || response === '') {
    throw new Error('No device found');
  }

  let device = {
    'name': '',
    'version': System.version,
    'features': {}
  };

  // find any number of spaces
  // ... match 1 or two hyphens with letters, numbers or hypen
  // find anything
  // ... match anything inside square brackets
  let pattern = /\s+([-]{1,2}[-a-zA-Z0-9]+) ?(.*) \[(.*)\]\n/g;
  let match;
  while ((match = pattern.exec(response)) !== null) {
    device.features[match[1]] = {
      'default': match[3],
      'parameters': match[2]
    };
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

  static filepath() {
    return './device.conf';
  }

  constructor() {
  }

  static from(o) {
    const device = new Device();
    if (typeof o === 'object') {
      const decorated = decorate(o);
      System.extend(device, decorated);
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
    const file = new FileInfo(Device.filepath());
    let isCached = true;
    if (!file.exists()) {
      log.debug('device.conf does not exist. Reloading');
      isCached = false;
    } else if (Device.from(file.toJson()).version !== System.version) {
      log.debug('device.conf version is old. Reloading');
      isCached = false;
    }

    if (!isCached) {
      const cmd = new CmdBuilder(Constants.Scanimage)
        .arg(' -A')
        .build();
  
      const data = await System.execute(cmd);
      const device = Device.from(data.output);
      file.save(JSON.stringify(device, null, 2));
      return device;
    } else {
      return Device.from(file.toJson());
    }
  }

  static reset() {
    const file = new FileInfo(Device.filepath());
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