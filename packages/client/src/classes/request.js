import Constants from './constants';

export default class Request {
  /**
   * @param {Request} request 
   * @param {Device} device 
   * @param {string} pipeline 
   * @param {string} batchMode
   * @returns 
   */
  static create(request, device, pipeline, batchMode) {
    request = request || {};
    request.params = request.params || {};

    const obj = {
      version: Constants.Version,
      params: {
        deviceId: device.id,
        top: request.params.top || device.features['-t'].default,
        left: request.params.left || device.features['-l'].default,
        width: request.params.width || device.features['-x'].default,
        height: request.params.height || device.features['-y'].default,
        resolution: request.params.resolution || device.features['--resolution'].default
      },
      filters: request.filters || [],
      pipeline: request.pipeline || pipeline,
      batch: request.batch || (batchMode === undefined ? 'none' : batchMode),
      index: 1
    };

    if ('--mode' in device.features) {
      obj.params.mode = request.params.mode || device.features['--mode'].default;
    }
    if ('--source' in device.features) {
      obj.params.source = request.params.source || device.features['--source'].default;
    }
    if ('--brightness' in device.features) {
      obj.params.brightness = request.params.brightness || device.features['--brightness'].default;
    }
    if ('--contrast' in device.features) {
      obj.params.contrast = request.params.contrast || device.features['--contrast'].default;
    }
    if ('--disable-dynamic-lineart' in device.features) {
      obj.params.dynamicLineart = request.params.dynamicLineart !== undefined
        ? request.params.dynamicLineart
        : true;
    }

    return obj;
  }
}