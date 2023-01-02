const log = require('loglevel').getLogger('Request');
const Constants = require('./constants');

/**
 * @param {number} data
 * @returns {ScanDeviceFeature} feature
 */
function constrainWithFeature(value, feature) {
  return Math.max(Math.min(value || feature.default, feature.limits[1]), feature.limits[0]);
}

class Request {
  constructor(context) {
    this.context = context;
    Object.assign(this, {
      params: {},
      pipeline: null
    });
  }

  /**
   * @param {ScanRequest} data
   * @returns {ScanRequest}
   */
  extend(data) {
    const device = this.context.getDevice(data.params.deviceId);
    const features = device.features;

    Object.assign(this, {
      params: {
        deviceId: device.id,
        resolution: data.params.resolution || features['--resolution'].default,
        format: 'tiff',
        isPreview: data.params.isPreview || false
      },
      filters: data.filters || [],
      pipeline: data.pipeline || null,
      batch: data.batch || Constants.BATCH_NONE,
      index: data.index || 1
    });

    if ('-t' in features) {
      this.params.top = constrainWithFeature(data.params.top, features['-t']);
    }
    if ('-l' in features) {
      this.params.left = constrainWithFeature(data.params.left, features['-l']);
    }
    if ('-x' in features) {
      this.params.width = constrainWithFeature(data.params.width, features['-x']);
    }
    if ('-y' in features) {
      this.params.height = constrainWithFeature(data.params.height, features['-y']);
    }
    if ('--page-height' in features) {
      this.params.pageHeight = constrainWithFeature(data.params.pageHeight, features['--page-height']);
    }
    if ('--page-width' in features) {
      this.params.pageWidth = constrainWithFeature(data.params.pageWidth, features['--page-width']);
    }

    if ('--mode' in features) {
      this.params.mode = data.params.mode || features['--mode'].default;
    }
    if ('--adf-mode' in features) {
      this.params.adfMode = data.params.adfMode || features['--adf-mode'].default;
    }
    if ('--source' in features) {
      this.params.source = data.params.source || features['--source'].default;
    }
    if ('--brightness' in features) {
      this.params.brightness = data.params.brightness || 0;
    }
    if ('--contrast' in features && this.params.mode !== 'Lineart') {
      this.params.contrast = data.params.contrast || 0;
    }
    if ('--disable-dynamic-lineart' in features) {
      this.params.dynamicLineart = data.params.dynamicLineart !== undefined
        ? data.params.dynamicLineart
        : true;
    }

    log.trace(JSON.stringify(this));
    return this;
  }
}

module.exports = Request;
