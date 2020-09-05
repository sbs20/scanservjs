const Constants = require('./Constants');
const Device = require('./Device');
const System = require('./System');
const FileInfo = require('./FileInfo');

const exists = function () {
  const fileInfo = new FileInfo(Constants.Scanimage);
  return fileInfo.exists();
};

const commandLine = function (scanRequest, device) {
  let cmd = Constants.Scanimage;
  if (device.name) {
    cmd += ' -d "' + device.name + '"';
  }
  cmd += ' --mode "' + scanRequest.mode + '"';

  if (device.isFeatureSupported('--depth') && 'depth' in scanRequest) {
    cmd += ' --depth ' + scanRequest.depth;
  }

  cmd += ' --resolution ' + scanRequest.resolution;
  cmd += ' -l ' + scanRequest.left;
  cmd += ' -t ' + scanRequest.top;
  cmd += ' -x ' + scanRequest.width;
  cmd += ' -y ' + scanRequest.height;
  cmd += ' --format ' + scanRequest.format;

  if (device.isFeatureSupported('--brightness')) {
    cmd += ' --brightness ' + scanRequest.brightness;
  }

  if (device.isFeatureSupported('--contrast')) {
    cmd += ' --contrast ' + scanRequest.contrast;
  }

  if (scanRequest.mode === 'Lineart' && !scanRequest.dynamicLineart &&
    device.isFeatureSupported('--disable-dynamic-lineart')) {
    cmd += ' --disable-dynamic-lineart=yes ';
  }

  if (scanRequest.convertFormat !== 'tif') {
    cmd += ' | convert - ' + scanRequest.convertFormat + ':-';
  }

  // Last
  cmd += ' > "' + scanRequest.outputFilepath + '"';
  return cmd;
};

class Scanimage {
  async execute(scanRequest) {
    if (!exists()) {
      throw new Error('Unable to find Scanimage at "' + Constants.Scanimage + '"');
    }

    const device = new Device();
    if ('device' in scanRequest && scanRequest.device) {
      device.load(scanRequest.device);
    }

    const response = {
      image: null,
      cmdline: null,
      output: [],
      errors: [],
      returnCode: -1
    };

    System.trace('Scanimage.execute:start');
    response.errors = scanRequest.validate(device);

    if (response.errors.length === 0) {
      response.cmdline = commandLine(scanRequest, device);
      const result = await System.execute(response.cmdline);
      System.trace('Scanimage.execute:finish', result);
      response.output = result.output;
      response.code = result.code;
      response.image = scanRequest.outputFilepath;
      return response;
    } else {
      throw new Error(response.errors.join('\n'));
    }
  }
}

module.exports = Scanimage;
