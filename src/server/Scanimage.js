const CmdBuilder = require('./CmdBuilder');
const Constants = require('./Constants');
const Device = require('./Device');
const System = require('./System');
const FileInfo = require('./FileInfo');

const exists = function () {
  const fileInfo = new FileInfo(Constants.Scanimage);
  return fileInfo.exists();
};

const commandLine = function (scanRequest, device) {
  const cmdBuilder = new CmdBuilder(Constants.Scanimage);
  if (device.name) {
    cmdBuilder.arg('-d', device.name);
  }

  cmdBuilder.arg('--mode', scanRequest.mode)
    .arg('--resolution', scanRequest.resolution)
    .arg('-l', scanRequest.left)
    .arg('-t', scanRequest.top)
    .arg('-x', scanRequest.width)
    .arg('-y', scanRequest.height)
    .arg('--format', scanRequest.format);

  if (device.isFeatureSupported('--depth') && 'depth' in scanRequest) {
    cmdBuilder.arg('--depth', scanRequest.depth);
  }
  if (device.isFeatureSupported('--brightness')) {
    cmdBuilder.arg('--brightness', scanRequest.brightness);
  }
  if (device.isFeatureSupported('--contrast')) {
    cmdBuilder.arg('--contrast', scanRequest.contrast);
  }
  if (scanRequest.mode === 'Lineart' && !scanRequest.dynamicLineart &&
      device.isFeatureSupported('--disable-dynamic-lineart')) {
    cmdBuilder.arg('--disable-dynamic-lineart=yes');
  }

  if (scanRequest.convertFormat !== 'tif') {
    cmdBuilder
      .pipe()
      .arg(`convert - ${scanRequest.convertFormat}:-`);
  }

  // Last
  return cmdBuilder
    .redirect()
    .arg(`"${scanRequest.outputFilepath}"`)
    .build();
};

class Scanimage {
  async execute(scanRequest) {
    if (!exists()) {
      throw new Error('Unable to find Scanimage at "' + Constants.Scanimage + '"');
    }

    if ('device' in scanRequest === false || !scanRequest.device) {
      throw new Error('No device found in request');
    }

    const device = Device.from(scanRequest.device);

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
