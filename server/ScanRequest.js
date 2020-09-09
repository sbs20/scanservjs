const log = require('loglevel').getLogger('ScanRequest');

const dateFormat = require('dateformat');
const Constants = require('./Constants');
const Device = require('./Device');
const System = require('./System');

class ScanRequest {
  static createDefault(device) {
    return {
      top: 0,
      left: 0,
      width: device.features['-x'].limits[1],
      height: device.features['-y'].limits[1],
      resolution: device.features['--resolution'].default,
      mode: device.features['--mode'].default,
      format: 'tiff',
      brightness: 0,
      contrast: 0,
      convertFormat: 'tif',
      dynamicLineart: true
    };
  }

  build(input) {
    const request = System.extend(ScanRequest.createDefault(this.device), input);

    if ('outputFilepath' in request === false) {
      const dateString = dateFormat(new Date(), 'yyyy-mm-dd HH.MM.ss');
      request.outputFilepath = Constants.OutputDirectory + 'scan_' + dateString + '.' + request.convertFormat;
    }
    if ('--brightness' in this.device.features === false) {
      delete request.brightness;
    }
    if ('--contrast' in this.device.features === false) {
      delete request.contrast;
    }
    if ('--disable-dynamic-lineart' in this.device.features === false) {
      delete request.dynamicLineart;
    }

    return request;
  }

  constructor(arg) {
    this.device = Device.from(arg.device);
    System.extend(this, this.build(arg));
    log.debug(this);
  }

  validate() {
    const errors = [];

    if (this.mode === undefined) {
      errors.push('Invalid mode: ' + this.mode);
    }

    if (!Number.isInteger(this.width)) {
      errors.push('Invalid width: ' + this.width);
    }

    if (!Number.isInteger(this.height)) {
      errors.push('Invalid height: ' + this.height);
    }

    if (!Number.isInteger(this.top)) {
      errors.push('Invalid top: ' + this.top);
    }

    if (!Number.isInteger(this.left)) {
      errors.push('Invalid left: ' + this.left);
    }

    if (!Number.isInteger(this.brightness)) {
      errors.push('Invalid brightness: ' + this.brightness);
    }

    if (!Number.isInteger(this.contrast)) {
      errors.push('Invalid contrast: ' + this.contrast);
    }

    if ('depth' in this && !Number.isInteger(this.depth)) {
      errors.push('Invalid depth: ' + this.depth);
    }

    if (this.top + this.height > this.device.features['-y'].limits[1]) {
      errors.push('Top + height exceed maximum dimensions');
    }

    if (['tif', 'jpg', 'png', 'pdf'].indexOf(this.convertFormat) === -1) {
      errors.push('Invalid format type');
    }

    return errors;
  }
}

module.exports = ScanRequest;