const Q = require('kew');
const Config = require('./Config');
const System = require('./System');
const FileInfo = require('./FileInfo');

const decorate = function (device) {
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
        break;
      
      case '--brightness':
      case '--contrast':
        params = feature.parameters.split('%')[0].split('..');
        feature.limits = [Number(params[0]), Number(params[1])];
        break;
      
    }
  }

  return device;
};

/// Parses the response of scanimage -A into a dictionary
const parse = function (response) {
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

  return device;
};

/// Executes scanimageA and returns a promise of parsed results
const scanimageA = function () {
  let cmd = Config.Scanimage;
  if (Config.DeviceName) {
    cmd += ' -d "' + Config.DeviceName + '"';
  }
  cmd += ' -A';

  return System.execute(cmd)
    .then((reply) => {
      try {
        const data = parse(reply.output);
        System.trace('device', data);
        return data;
      } catch (exception) {
        return Q.reject(exception);
      }
    });
};

class Device {
  constructor() {
  }

  load(data) {
    System.extend(this, data);
  }

  /// Attempts to get a stored configuration of our device and if
  /// not gets it from the command line.
  get() {
    const conf = new FileInfo('./device.conf');
    let isLoadRequired = false;
    if (!conf.exists()) {
      System.trace('device.conf does not exist. Reloading');
      isLoadRequired = true;
    } else if (JSON.parse(conf.toText()).version !== System.version) {
      System.trace('device.conf version is old. Reloading');
      isLoadRequired = true;
    }

    if (isLoadRequired) {
      return scanimageA().then((data) => {
        // Humans might read this, so pretty
        conf.save(JSON.stringify(data, null, 4));
        return decorate(data);
      });
    } else {
      return Q.resolve(decorate(JSON.parse(conf.toText())));
    }
  }

  isFeatureSupported(feature) {
    if (this.features && feature in this.features) {
      return this.features[feature].default !== 'inactive';
    }

    return false;
  }

  modes() {
    return this.features['--mode'].options.split('|');
  }
}

module.exports = Device;