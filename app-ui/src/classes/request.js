import Constants from './constants';

export default class Request {

  /**
   * @param {Request} request 
   * @param {Device} device
   */
  constructor(request, device) {
    request = request || {};
    request.params = request.params || {};

    Object.assign(this, {
      version: Constants.Version,
      params: {
        deviceId: device.id,
        resolution: request.params.resolution || device.features['--resolution'].default
      },
      filters: request.filters || device.settings.filters.default,
      pipeline: request.pipeline || device.settings.pipeline.default,
      batch: request.batch || device.settings.batchMode.default,
      index: 1
    });

    if ('-x' in device.features) {
      this.params.width = request.params.width || device.features['-x'].default;
    }
    if ('-y' in device.features) {
      this.params.height = request.params.height || device.features['-y'].default;
    }
    if ('-l' in device.features) {
      this.params.left = request.params.left || device.features['-l'].default;
    }
    if ('-t' in device.features) {
      this.params.top = request.params.top || device.features['-t'].default;
    }
    if ('--page-height' in device.features) {
      this.params.pageHeight = request.params.pageHeight || device.features['--page-height'].default;
    }
    if ('--page-width' in device.features) {
      this.params.pageWidth = request.params.pageWidth || device.features['--page-width'].default;
    }
    
    if ('--adf-mode' in device.features) {
      this.params.adfMode = request.params.adfMode || device.features['--adf-mode'].default;
    }
    if ('--mode' in device.features) {
      this.params.mode = request.params.mode || device.features['--mode'].default;
    }
    if ('--source' in device.features) {
      this.params.source = request.params.source || device.features['--source'].default;
    }
    if ('--brightness' in device.features) {
      this.params.brightness = request.params.brightness || device.features['--brightness'].default;
    }
    if ('--contrast' in device.features) {
      this.params.contrast = request.params.contrast || device.features['--contrast'].default;
    }
    if ('--disable-dynamic-lineart' in device.features) {
      this.params.dynamicLineart = request.params.dynamicLineart !== undefined
        ? request.params.dynamicLineart
        : true;
    }
  }

  /**
   * @param {Request} request 
   * @param {Device} device
   * @returns 
   */
  static create(request, device) {
    return new Request(request, device);
  }
}
