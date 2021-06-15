const log = require('loglevel').getLogger('Request');
const Constants = require('./constants');
const extend = require('./util').extend;

const bound = (n, min, max, def) => {
  return Math.max(Math.min(n || def, max), min);
};

class Request {
  constructor(context) {
    this.context = context;
    this.extend({
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
    extend(this, {
      params: {
        deviceId: device.id,
        top: bound(data.params.top, features['-t'].limits[0], features['-t'].limits[1], 0),
        left: bound(data.params.left, features['-l'].limits[0], features['-l'].limits[1], 0),
        width: bound(data.params.width, features['-x'].limits[0], features['-x'].limits[1], features['-x'].limits[1]),
        height: bound(data.params.height, features['-y'].limits[0], features['-y'].limits[1], features['-y'].limits[1]),
        resolution: data.params.resolution || features['--resolution'].default,
        format: 'tiff'
      },
      filters: data.filters || [],
      pipeline: data.pipeline || null,
      batch: data.batch || Constants.BATCH_NONE,
      index: data.index || 1
    });

    if ('--mode' in features) {
      this.params.mode = data.params.mode || features['--mode'].default;
    }
    if ('--source' in features) {
      this.params.source = data.params.source || features['--source'].default;
    }
    if ('--brightness' in features) {
      this.params.brightness = data.params.brightness || 0;
    }
    if ('--contrast' in features) {
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