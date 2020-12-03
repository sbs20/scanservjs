const log = require('loglevel').getLogger('Scanimage');

const CmdBuilder = require('./command-builder');
const Config = require('../config/config');
const Constants = require('./constants');

class Scanimage {
  static devices() {
    return new CmdBuilder(Config.scanimage)
      .arg('-L')
      .build();
  }
  
  static features(deviceId) {
    return new CmdBuilder(Config.scanimage)
      .arg('-d', deviceId)
      .arg('-A')
      .build();
  }

  static scan(request) {
    log.debug(JSON.stringify(request));
    const params = request.params;
    const cmdBuilder = new CmdBuilder(Config.scanimage);
    cmdBuilder.arg('-d', params.deviceId)
      .arg('--mode', params.mode);

    // Source needs to go before resolution
    if ('source' in params) {
      cmdBuilder.arg('--source', params.source);
    }
      
    cmdBuilder.arg('--resolution', params.resolution)
      .arg('-l', params.left)
      .arg('-t', params.top)
      .arg('-x', params.width)
      .arg('-y', params.height)
      .arg('--format', params.format);
  
    if ('depth' in params) {
      cmdBuilder.arg('--depth', params.depth);
    }
    if ('brightness' in params) {
      cmdBuilder.arg('--brightness', params.brightness);
    }
    if ('contrast' in params) {
      cmdBuilder.arg('--contrast', params.contrast);
    }
    if (params.mode === 'Lineart' && params.dynamicLineart === false) {
      cmdBuilder.arg('--disable-dynamic-lineart=yes');
    }
    if (request.batch === Constants.BATCH_AUTO) {
      cmdBuilder.arg(`--batch=${Config.tempDirectory}${Constants.TEMP_FILESTEM}%04d.tif`);
    } else {
      const number = `000${request.page}`.slice(-4);
      cmdBuilder.arg(`> ${Config.tempDirectory}${Constants.TEMP_FILESTEM}${number}.tif`);
    }
    return cmdBuilder.build();
  }
}

module.exports = Scanimage;
