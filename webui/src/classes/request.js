import Constants from './constants';

export default {
  create(request, device, pipeline) {
    if (request === null) {
      request = {
        version: Constants.Version,
        params: {
          deviceId: device.id,
          top: device.features['-t'].default,
          left: device.features['-l'].default,
          width: device.features['-x'].default,
          height: device.features['-y'].default,
          resolution: device.features['--resolution'].default,
          mode: device.features['--mode'].default
        },
        filters: [],
        pipeline: pipeline,
        batch: 'none',
        index: 1
      };
    }

    if ('--source' in device.features) {
      request.params.source = request.params.source || device.features['--source'].default;
    }
    if ('--brightness' in device.features) {
      request.params.brightness = request.params.brightness || device.features['--brightness'].default;
    }
    if ('--contrast' in device.features) {
      request.params.contrast = request.params.contrast || device.features['--contrast'].default;
    }
    if ('--disable-dynamic-lineart' in device.features) {
      request.params.dynamicLineart = request.params.dynamicLineart !== undefined
        ? request.params.dynamicLineart
        : true;
    }

    return request;
  }
};