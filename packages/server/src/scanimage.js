const log = require('loglevel').getLogger('Scanimage');

const CmdBuilder = require('./command-builder');
const Config = require('./config');
const Constants = require('./constants');

class Scanimage {
  /**
   * @returns {string}
   */
  static devices() {
    return new CmdBuilder(Config.scanimage)
      .arg('-L')
      .build();
  }
  
  /**
   * @param {string} deviceId
   * @returns {string}
   */
  static features(deviceId) {
    return new CmdBuilder(Config.scanimage)
      .arg('-d', deviceId)
      .arg('-A')
      .build();
  }

  /**
   * @param {number} page 
   * @returns {string}
   */
  static filename(page) {
    const number = `000${page}`.slice(-4);
    return `${Config.tempDirectory}/${Constants.TEMP_FILESTEM}-0-${number}.tif`;
  }

  /**
   * @param {ScanRequest} request 
   * @returns {string}
   */
  static scan(request) {
    log.debug(JSON.stringify(request));
    const params = request.params;
    const cmdBuilder = new CmdBuilder(Config.scanimage);
    cmdBuilder.arg('-d', params.deviceId);

    if ('mode' in params) {
      cmdBuilder.arg('--mode', params.mode);
    }

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
    if ([Constants.BATCH_AUTO, Constants.BATCH_COLLATE_STANDARD, Constants.BATCH_COLLATE_REVERSE]
      .includes(request.batch)) {
      const pattern = `${Config.tempDirectory}/${Constants.TEMP_FILESTEM}-${request.index}-%04d.tif`;
      cmdBuilder.arg(`--batch=${pattern}`);
    } else {
      cmdBuilder.arg(`> ${Scanimage.filename(request.index)}`);
    }
    return cmdBuilder.build();
  }
}

module.exports = Scanimage;
