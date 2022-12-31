const log = require('loglevel').getLogger('Scanimage');

const CmdBuilder = require('./command-builder');
/** @type {Configuration} */
const Config = require('./config');
const Constants = require('./constants');
const Process = require('./process');
const semver = require('semver');

class Scanimage {
  get version() {
    if (this._version === undefined) {
      const result = Process.executeSync(`${Config.scanimage} -V`);
      this._version = /.*backend version (.*)/.exec(result)[1];
    }
    return this._version;
  }

  get supportsOutputFlag() {
    return semver.satisfies(this.version, '>=1.0.28');
  }
}

class ScanimageCommand {
  constructor() {
    this.scanimage = new Scanimage();
  }

  /**
   * @returns {string}
   */
  devices() {
    return new CmdBuilder(Config.scanimage)
      .arg('-L')
      .build();
  }
  
  /**
   * @param {string} deviceId
   * @returns {string}
   */
  features(deviceId) {
    return new CmdBuilder(Config.scanimage)
      .arg('-d', deviceId)
      .arg('-A')
      .build();
  }

  /**
   * @param {number} page 
   * @returns {string}
   */
  filename(page) {
    const number = `000${page}`.slice(-4);
    return `${Config.tempDirectory}/${Constants.TEMP_FILESTEM}-0-${number}.tif`;
  }

  /**
   * @param {ScanRequest} request 
   * @returns {string}
   */
  scan(request) {
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

    if ('adfMode' in params) {
      cmdBuilder.arg('--adf-mode', params.adfMode);
    }
    cmdBuilder.arg('--resolution', params.resolution);

    if ('pageWidth' in params) {
      cmdBuilder.arg('--page-width', params.pageWidth);
    }
    if ('pageHeight' in params) {
      cmdBuilder.arg('--page-height', params.pageHeight);
    }
    if ('left' in params) {
      cmdBuilder.arg('-l', params.left);
    }
    if ('top' in params) {
      cmdBuilder.arg('-t', params.top);
    }
    if ('width' in params) {
      cmdBuilder.arg('-x', params.width);
    }
    if ('height' in params) {
      cmdBuilder.arg('-y', params.height);
    }

    cmdBuilder.arg('--format', params.format);
  
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
    if ([Constants.BATCH_AUTO, Constants.BATCH_COLLATE_STANDARD, Constants.BATCH_COLLATE_REVERSE].includes(request.batch)) {
      const pattern = `${Config.tempDirectory}/${Constants.TEMP_FILESTEM}-${request.index}-%04d.tif`;
      cmdBuilder.arg(`--batch=${pattern}`);
    } else {
      const outputFile = 'isPreview' in params && params.isPreview
        ? `${Config.previewDirectory}/preview.tif`
        : this.filename(request.index);

      if (this.scanimage.supportsOutputFlag) {
        cmdBuilder.arg('-o', outputFile);
      } else {
        cmdBuilder.arg('>', outputFile);
      }
    }
    return cmdBuilder.build();
  }
}

const scanimageCommand = new ScanimageCommand();

module.exports = scanimageCommand;
