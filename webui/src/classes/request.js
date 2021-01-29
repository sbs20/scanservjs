import Constants from './constants';

export default {
  create(request, device, pipeline) {
    if (request === null) {
      request = {
        version: Constants.Version,
        params: {
          deviceId: device.id,
          top: 0,
          left: 0,
          width: device.features['-x'].limits[1],
          height: device.features['-y'].limits[1],
          resolution: device.features['--resolution'].default,
          mode: device.features['--mode'].default
        },
        pipeline: pipeline,
        batch: 'none',
        index: 1
      };
    }

    if ('--source' in device.features) {
      request.params.source = request.params.source || device.features['--source'].default;
    }
    if ('--brightness' in device.features) {
      request.params.brightness = request.params.brightness || 0;
    }
    if ('--contrast' in device.features) {
      request.params.contrast = request.params.contrast || 0;
    }
    if ('--disable-dynamic-lineart' in device.features) {
      request.params.dynamicLineart = request.params.dynamicLineart !== undefined
        ? request.params.dynamicLineart
        : true;
    }

    return request;
  }
};