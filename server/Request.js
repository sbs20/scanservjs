const log = require('loglevel').getLogger('Request');
const System = require('./System');

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
    const device = data.params.deviceId
      ? this.context.devices.filter(device => device.name === data.params.deviceId)[0]
      : this.context.devices[0];

    System.extend(this, {
      params: {
        deviceId: device.name,
        top: bound(data.params.top, device.features['-t'].limits[0], device.features['-t'].limits[1], 0),
        left: bound(data.params.left, device.features['-l'].limits[0], device.features['-l'].limits[1], 0),
        width: bound(data.params.width, device.features['-x'].limits[0], device.features['-x'].limits[1], device.features['-x'].limits[1]),
        height: bound(data.params.height, device.features['-y'].limits[0], device.features['-y'].limits[1], device.features['-y'].limits[1]),
        resolution: data.params.resolution || device.features['--resolution'].default,
        mode: data.params.mode || device.features['--mode'].default,
        format: 'tiff',
        brightness: data.params.brightness || 0,
        contrast: data.params.contrast || 0,
        dynamicLineart: true  
      },
      pipeline: data.pipeline || null
    });

    if ('--brightness' in device.features === false) {
      delete this.params.brightness;
    }
    if ('--contrast' in device.features === false) {
      delete this.params.contrast;
    }
    if ('--disable-dynamic-lineart' in device.features === false) {
      delete this.params.dynamicLineart;
    }

    log.debug(this);
    return this;
  }
}

module.exports = Request;