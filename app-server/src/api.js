const log = require('loglevel').getLogger('Api');

const FileInfo = require('./classes/file-info');
const LogFormatter = require('./classes/log-formatter');
const Process = require('./classes/process');
const Request = require('./classes/request');
const ScanController = require('./scan-controller');

const application = require('./application');
const config = application.config();
const scanimageCommand = application.scanimageCommand();

module.exports = new class Api {

  /**
   * @returns {Promise.<FileInfo[]>}
   */
  async fileList() {
    log.trace('fileList()');
    const dir = FileInfo.create(config.outputDirectory);
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
    const thumbnail = FileInfo.unsafe(config.thumbnailDirectory, name);
    if (thumbnail.exists()) {
      thumbnail.delete();
    }
    const file = FileInfo.unsafe(config.outputDirectory, name);
    return file.delete();
  }

  /**
   * Runs an action on a file
   * @param {string} actionName
   * @param {string} fileName
   * @returns {Promise.<any>}
   */
  async fileAction(actionName, fileName) {
    const fileInfo = FileInfo.unsafe(config.outputDirectory, fileName);
    if (!fileInfo.exists()) {
      throw new Error(`File '${fileName}' does not exist`);
    }
    await application.userOptions().action(actionName).execute(fileInfo);
  }

  /**
   * @param {ScanRequest} req
   * @returns {Promise<any>}
   */
  async createPreview(req) {
    const context = await application.context();
    const request = new Request(context, {
      params: {
        deviceId: req.params.deviceId,
        mode: req.params.mode,
        source: req.params.source,
        resolution: config.previewResolution,
        brightness: req.params.brightness,
        contrast: req.params.contrast,
        dynamicLineart: req.params.dynamicLineart,
        isPreview: true
      }
    });

    const cmd = `${scanimageCommand.scan(request)}`;
    log.trace('Executing cmd:', cmd);
    await Process.spawn(cmd);
    return {};
  }

  /**
   * @returns {FileInfo}
   */
  deletePreview() {
    log.trace('deletePreview()');
    const file = FileInfo.create(`${config.previewDirectory}/preview.tif`);
    return file.delete();
  }

  /**
   * @param {string[]} filters
   * @param {Object} transformations
   * @returns {Promise.<{buffer: Buffer, isDefault: boolean}>}
   */
  async readPreview(filters, transformations) {
    log.trace('readPreview()', filters, transformations);
    // The UI relies on this image being the correct aspect ratio. If there is a
    // preview image then just use it.
    const source = FileInfo.create(`${config.previewDirectory}/preview.tif`);
    if (source.exists()) {
      const buffer = source.toBuffer();
      const cmds = [...config.previewPipeline.commands];
      if (filters && filters.length) {
        const params = application.filterBuilder().build(filters, true);
        cmds.splice(0, 0, `convert - ${params} tif:-`);
      }

      // We need to know the physical dimensions of the preview.tif (full bed)
      const context = await application.context();
      const device = context.getDevice();
      const inputImageBounds = {
        left: 0,
        top: 0,
        width: (device.features['-x'] && device.features['-x'].limits) ? device.features['-x'].limits[1] : 215.9,
        height: (device.features['-y'] && device.features['-y'].limits) ? device.features['-y'].limits[1] : 279.4
      };

      // Apply transformations (rotation, flip)
      const transformParams = Api._buildTransformParams(config, transformations, inputImageBounds);
      if (transformParams) {
        log.trace({ transformParams });
        cmds.splice(0, 0, `convert - ${transformParams} tif:-`);
      }

      return {
        buffer: await Process.chain(cmds, buffer, { ignoreErrors: true }),
        isDefault: false
      };
    }

    // If not then it's possible the default image is not quite the correct aspect ratio
    const buffer = FileInfo.create(`${config.previewDirectory}/default.jpg`).toBuffer();

    try {
      // We need to know the correct aspect ratio from the device
      const context = await application.context();
      const device = context.getDevice();
      const heightByWidth = device.features['-y'].limits[1] / device.features['-x'].limits[1];
      const width = 868;
      const height = Math.round(width * heightByWidth);
      return {
        buffer: await Process.spawn(`convert - -resize ${width}x${height}! jpg:-`, buffer),
        isDefault: true
      };
    } catch (e) {
      return {
        buffer: buffer,
        isDefault: true
      };
    }
  }

  /**
   * Build ImageMagick transformation parameters
   * @param {Object} config
   * @param {Object} transformations
   * @param {Object} inputImageBounds
   * @returns {string}
   */
  static _buildTransformParams(config, transformations, inputImageBounds) {
    if (!transformations) {
      return '';
    }

    const params = [];

    if (transformations.magic && inputImageBounds) {
        const ox = inputImageBounds.left;
        const oy = inputImageBounds.top;
        const iw = inputImageBounds.width;
        const ih = inputImageBounds.height;

        const width = parseFloat(transformations.width) || iw;
        const height = parseFloat(transformations.height) || ih;

        let magic = transformations.magic;
        magic = magic.replace(/{OX}/g, ox);
        magic = magic.replace(/{OY}/g, oy);
        magic = magic.replace(/{IW}/g, iw);
        magic = magic.replace(/{IH}/g, ih);
        magic = magic.replace(/{TW}/g, width);
        magic = magic.replace(/{TH}/g, height);
        // Safety for legacy placeholders
        magic = magic.replace(/{TCX}/g, '0');
        magic = magic.replace(/{TCY}/g, '0');
        if (/[;|&$`\n\r(){}<>]/.test(magic)) {
          throw new Error('Transformation contains unsafe characters');
        }
        params.push(magic);
    }

    // Handle rotation
    const rotation = parseInt(transformations.rotation, 10) || 0;
    if (rotation !== 0) {
      params.push(`-rotate ${rotation}`);
    }

    // Handle horizontal flip
    if (transformations.flipH === 'true' || transformations.flipH === true) {
      params.push('-flop');
    }

    // Handle vertical flip
    if (transformations.flipV === 'true' || transformations.flipV === true) {
      params.push('-flip');
    }

    return params.join(' ');
  }

  /**
   * @param {string} name
   * @returns {Promise.<Buffer>}
   */
  async readThumbnail(name) {
    const source = FileInfo.unsafe(config.outputDirectory, name);
    if (source.extension !== '.zip') {
      const thumbnail = FileInfo.unsafe(config.thumbnailDirectory, name);
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
    return await ScanController.run(req);
  }

  /**
   * @returns {void}
   */
  deleteContext() {
    application.deviceReset();
    this.deletePreview();
  }

  /**
   * @returns {Promise.<Context>}
   */
  async readContext() {
    const context = await application.context();
    log.info(LogFormatter.format().full(context));
    return context;
  }

  /**
   * @returns {Promise.<SystemInfo>}
   */
  async readSystem() {
    const systemInfo = await application.systemInfo();
    log.debug(LogFormatter.format().full(systemInfo));
    return systemInfo;
  }

  /**
   * @param {Object} params
   * @returns {Promise.<Object>}
   */
  async autoCrop(params) {
    log.trace('autoCrop()', params);
    const source = FileInfo.create(`${config.previewDirectory}/preview.tif`);
    
    // Guardrail: if preview image does not exist, immediately return zero-value
    if (!source.exists()) {
      log.info('AutoCrop aborted: preview.tif does not exist');
      return { magic: null };
    }

    const context = await application.context();
    const device = context.getDevice(params.deviceId);
    const bedW = device.features['-x'].limits[1];
    const bedH = device.features['-y'].limits[1];

    const left = parseFloat(params.left) || 0;
    const top = parseFloat(params.top) || 0;
    const width = parseFloat(params.width) || bedW;
    const height = parseFloat(params.height) || bedH;

    const args = [
      `--image '${source.fullname}'`,
      `--left ${left}`,
      `--top ${top}`,
      `--width ${width}`,
      `--height ${height}`,
      `--bed-width ${bedW}`,
      `--bed-height ${bedH}`
    ].join(' ');

    const cmd = `.venv/bin/python autocrop/autocrop.py ${args}`;
    try {
      const stdout = await Process.execute(cmd);
      let parsed;
      try {
        parsed = JSON.parse(stdout.trim());
      } catch (parseErr) {
        log.error('AutoCrop JSON parse failed. Stdout was:', stdout);
        return { magic: null, error: `Invalid response: ${stdout.substring(0, 100)}` };
      }
      if (parsed.error) {
        log.error('AutoCrop python script error:', parsed.error);
        return { magic: null, error: parsed.error };
      }
      return parsed;
    } catch (e) {
      log.error('AutoCrop execution failed', e.message, e.stderr);
      return { magic: null, error: `Execution failed: ${(e.stderr || e.message || "Unknown error").substring(0, 100)}` };
    }
  }
};
