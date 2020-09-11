const log = require('loglevel').getLogger('Scanimage');

const CmdBuilder = require('./CmdBuilder');
const Config = require('../config/config');
const Device = require('./Device');
const System = require('./System');

class Scanimage {
  static command(scanRequest) {
    if ('device' in scanRequest === false || !scanRequest.device) {
      throw new Error('No device found in request');
    }

    const device = Device.from(scanRequest.device);

    const cmdBuilder = new CmdBuilder(Config.scanimage);
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
  
    return cmdBuilder.build();
  }

  static _shim(scanRequest) {
    let cmd = Scanimage.command(scanRequest);
    if (scanRequest.convertFormat !== 'tif') {
      cmd += ` | convert - ${scanRequest.convertFormat}:-`;
    }
    return cmd + ` > "${scanRequest.outputFilepath}"`;
  }

  async execute(scanRequest) {
    const response = {
      image: null,
      cmdline: null,
      output: [],
      errors: [],
      returnCode: -1
    };

    log.debug('Scanimage.execute:start');
    response.errors = scanRequest.validate();

    if (response.errors.length === 0) {
      response.cmdline = Scanimage._shim(scanRequest);
      const result = await System.execute(response.cmdline);
      log.debug('Scanimage.execute:finish', result);
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
