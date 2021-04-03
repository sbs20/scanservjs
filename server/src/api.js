const log = require('loglevel').getLogger('Api');
const Config = require('./config');
const Context = require('./context');
const Devices = require('./devices');
const FileInfo = require('./file-info');
const Filters = require('./filters');
const Process = require('./process');
const Request = require('./request');
const Scanimage = require('./scanimage');
const ScanController = require('./scan-controller');

class Api {

  /**
   * @returns {Promise.<FileInfo[]>}
   */
  static async fileList() {
    log.trace('fileList()');
    const dir = new FileInfo(Config.outputDirectory);
    let files = await dir.list();
    files = files
      .filter(f => ['.tif', '.jpg', '.png', '.pdf', '.txt', '.zip'].includes(f.extension))
      .sort((f1, f2) => f2.lastModified - f1.lastModified);
    log.trace(JSON.stringify(files));
    return files;
  }

  /**
   * @param {string} fullpath 
   * @returns {FileInfo}
   */
  static fileDelete(fullpath) {
    log.trace('fileDelete()');
    const file = new FileInfo(fullpath);
    const parent = new FileInfo(file.path);
    const data = new FileInfo(Config.outputDirectory);
    if (!parent.equals(data)) {
      throw new Error('Cannot delete outside of data directory');
    }
    return file.delete();
  }

  /**
   * @param {ScanRequest} req 
   * @returns {Promise<any>}
   */
  static async createPreview(req) {
    const context = await Context.create();
    const request = new Request(context).extend({
      params: {
        deviceId: req.params.deviceId,
        mode: req.params.mode,
        resolution: Config.previewResolution,
        brightness: req.params.brightness,
        contrast: req.params.contrast,
        dynamicLineart: req.params.dynamicLineart
      }
    });

    const cmd = `${Scanimage.scan(request)} > ${Config.previewDirectory}preview.tif`;
    log.trace('Executing cmd:', cmd);
    await Process.spawn(cmd);
    return {};
  }

  /**
   * @returns {FileInfo}
   */
  static deletePreview() {
    log.trace('deletePreview()');
    const file = new FileInfo(`${Config.previewDirectory}preview.tif`);
    return file.delete();
  }

  /**
   * @param {string[]} filters
   * @returns {Promise.<Buffer>}
   */
  static async readPreview(filters) {
    log.trace('readPreview()', filters);
    // The UI relies on this image being the correct aspect ratio. If there is a
    // preview image then just use it. 
    const source = new FileInfo(`${Config.previewDirectory}preview.tif`);
    if (source.exists()) {
      const buffer = source.toBuffer();
      const cmds = [...Config.previewPipeline.commands];
      if (filters) {
        const params = Filters.build(filters, true);
        cmds.splice(0, 0, `convert - ${params} tif:-`);
      }
    
      return await Process.chain(cmds, buffer, { ignoreErrors: true });
    }

    // If not then it's possible the default image is not quite the correct aspect ratio
    const buffer = new FileInfo(`${Config.previewDirectory}default.jpg`).toBuffer();

    // We need to know the correct AR from the device
    const context = await Context.create();
    const device = context.getDevice();
    const heightByWidth = device.features['-y'].limits[1] / device.features['-x'].limits[1];
    const width = 868;
    const height = Math.round(width * heightByWidth);
    return await Process.spawn(`convert - -resize ${width}x${height}! jpg:-`, buffer);
  }

  /**
   * @param {ScanRequest} req 
   * @returns {ScanResponse}
   */
  static async scan(req) {
    return await ScanController.run(req);
  }

  /**
   * @param {boolean} [force] 
   * @returns {Promise.<Context>}
   */
  static async context(force) {
    if (force) {
      Devices.reset();
      this.deletePreview();
    }
    const context = await Context.create();
    context.filters = context.filters.map(f => f.description);
    context.pipelines = context.pipelines.map(p => p.description);
    return context;
  }
}

module.exports = Api;
