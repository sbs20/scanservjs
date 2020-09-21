const log = require('loglevel').getLogger('Request');
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
        mode: data.params.mode || features['--mode'].default,
        format: 'tiff',
        brightness: data.params.brightness || 0,
        contrast: data.params.contrast || 0,
        dynamicLineart: true  
      },
      pipeline: data.pipeline || null,
      batch: data.batch || false,
      page: data.page || 1
    });

    if ('--brightness' in features === false) {
      delete this.params.brightness;
    }
    if ('--contrast' in features === false) {
      delete this.params.contrast;
    }
    if ('--disable-dynamic-lineart' in features === false) {
      delete this.params.dynamicLineart;
    }

    log.debug(this);
    return this;
  }
}

module.exports = Request;