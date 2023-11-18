const log = require('loglevel').getLogger('Api');

const FileInfo = require('./classes/file-info');
const LogFormatter = require('./classes/log-formatter');
const Process = require('./classes/process');
const Request = require('./classes/request');
const ScanController = require('./scan-controller');

module.exports = class Api {
  constructor(application) {
    this.application = application;
  }

  /**
   * @returns {Promise.<FileInfo[]>}
   */
  async fileList() {
    log.trace('fileList()');
    const dir = FileInfo.create(this.application.config.outputDirectory);
    let files = await dir.list();
    files = files
      .sort((f1, f2) => f2.lastModified - f1.lastModified);
    log.trace(LogFormatter.format().full(files));
    return files;
  }

  /**
   * @param {string} name
   * @returns {FileInfo}
   */
  fileDelete(name) {
    log.trace('fileDelete()');
    const thumbnail = FileInfo.unsafe(this.application.config.thumbnailDirectory, name);
    if (thumbnail.exists()) {
      thumbnail.delete();
    }
    const file = FileInfo.unsafe(this.application.config.outputDirectory, name);
    return file.delete();
  }

  /**
   * Runs an action on a file
   * @param {string} actionName
   * @param {string} fileName
   * @returns {Promise.<any>}
   */
  async fileAction(actionName, fileName) {
    const fileInfo = FileInfo.unsafe(this.application.config.outputDirectory, fileName);
    if (!fileInfo.exists()) {
      throw new Error(`File '${fileName}' does not exist`);
    }
    await this.application.userOptions.action(actionName).execute(fileInfo);
  }

  /**
   * @param {ScanRequest} req
   * @returns {Promise<any>}
   */
  async createPreview(req) {
    const context = await this.application.context();
    const request = new Request(context, {
      params: {
        deviceId: req.params.deviceId,
        mode: req.params.mode,
        source: req.params.source,
        resolution: this.application.config.previewResolution,
        brightness: req.params.brightness,
        contrast: req.params.contrast,
        dynamicLineart: req.params.dynamicLineart,
        isPreview: true
      }
    });

    const cmd = `${this.application.scanimageCommand.scan(request)}`;
    log.trace('Executing cmd:', cmd);
    await Process.spawn(cmd);
    return {};
  }

  /**
   * @returns {FileInfo}
   */
  deletePreview() {
    log.trace('deletePreview()');
    const file = FileInfo.create(`${this.application.config.previewDirectory}/preview.tif`);
    return file.delete();
  }

  /**
   * @param {string[]} filters
   * @returns {Promise.<Buffer>}
   */
  async readPreview(filters) {
    log.trace('readPreview()', filters);
    // The UI relies on this image being the correct aspect ratio. If there is a
    // preview image then just use it.
    const source = FileInfo.create(`${this.application.config.previewDirectory}/preview.tif`);
    if (source.exists()) {
      const buffer = source.toBuffer();
      const cmds = [...this.application.config.previewPipeline.commands];
      if (filters && filters.length) {
        const params = this.application.filterBuilder().build(filters, true);
        cmds.splice(0, 0, `convert - ${params} tif:-`);
      }

      return await Process.chain(cmds, buffer, { ignoreErrors: true });
    }

    // If not then it's possible the default image is not quite the correct aspect ratio
    const buffer = FileInfo.create(`${this.application.config.previewDirectory}/default.jpg`).toBuffer();

    try {
      // We need to know the correct aspect ratio from the device
      const context = await this.application.context();
      const device = context.getDevice();
      const heightByWidth = device.features['-y'].limits[1] / device.features['-x'].limits[1];
      const width = 868;
      const height = Math.round(width * heightByWidth);
      return await Process.spawn(`convert - -resize ${width}x${height}! jpg:-`, buffer);
    } catch (e) {
      return Promise.resolve(buffer);
    }
  }

  /**
   * @param {string} name
   * @returns {Promise.<Buffer>}
   */
  async readThumbnail(name) {
    const source = FileInfo.unsafe(this.application.config.outputDirectory, name);
    if (source.extension !== '.zip') {
      const thumbnail = FileInfo.unsafe(this.application.config.thumbnailDirectory, name);
      if (thumbnail.exists()) {
        return thumbnail.toBuffer();
      } else {
        const buffer = await Process.spawn(`convert '${source.fullname}'[0] -resize 256 -quality 75 jpg:-`);
        thumbnail.save(buffer);
        return buffer;
      }
    }
    return [];
  }

  /**
   * @param {ScanRequest} req
   * @returns {ScanResponse}
   */
  async scan(req) {
    return await ScanController.run(this.application, req);
  }

  /**
   * @returns {void}
   */
  deleteContext() {
    this.application.deviceReset();
    this.deletePreview();
  }

  /**
   * @returns {Promise.<Context>}
   */
  async readContext() {
    const context = await this.application.context();
    log.info(LogFormatter.format().full(context));
    return context;
  }

  /**
   * @returns {Promise.<SystemInfo>}
   */
  async readSystem() {
    const systemInfo = await this.application.systemInfo();
    log.debug(LogFormatter.format().full(systemInfo));
    return systemInfo;
  }
};
