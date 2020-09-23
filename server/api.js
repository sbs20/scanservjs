const fs = require('fs');
const log = require('loglevel').getLogger('Api');

const Config = require('../config/config');
const Context = require('./context');
const Device = require('./device');
const FileInfo = require('./file-info');
const Process = require('./process');
const Request = require('./request');
const Scanimage = require('./scanimage');

class Api {
  static async fileList() {
    log.debug('fileList()');
    return await new Promise((resolve, reject) => {
      let outdir = Config.outputDirectory;
      fs.readdir(outdir, (err, list) => {
        if (err) {
          reject(err);
        }
  
        let files = list
          .map(f => new FileInfo(outdir + f))
          .filter(f => ['.tif', '.jpg', '.png', '.pdf', '.txt'].includes(f.extension))
          .sort((f1, f2) => f2.lastModified - f1.lastModified);

        log.debug(JSON.stringify(files));
        resolve(files);
      });
    });
  }

  static fileDelete(fullpath) {
    const file = new FileInfo(fullpath);
    const parent = new FileInfo(file.path);
    const data = new FileInfo(Config.outputDirectory);
    if (!parent.equals(data)) {
      throw new Error('Cannot delete outside of data directory');
    }
    return file.delete();
  }

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
    log.debug('Executing cmd:', cmd);
    await Process.spawn(cmd);
    return {};
  }

  static async readPreview() {
    // The UI relies on this image being the correct aspect ratio. If there is a
    // preview image then just use it. 
    const source = new FileInfo(`${Config.previewDirectory}preview.tif`);
    if (source.exists()) {
      const buffer = source.toBuffer();
      return await Process.chain(Config.previewPipeline.commands, buffer, true);
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

  static async scan(req) {
    const context = await Context.create();
    const request = new Request(context).extend(req);
    const stem = '~tmp-scan-';

    if (request.batch === undefined || request.batch === false) {
      const pipeline = context.pipelines.filter(p => p.description === request.pipeline)[0];
      if (pipeline === undefined) {
        throw Error('No matching pipeline');
      }
      const cmds = [Scanimage.scan(request)].concat(pipeline.commands);
      log.debug('Executing cmds:', cmds);
      const buffer = await Process.chain(cmds);
      const filename = `${Config.outputDirectory}${Config.filename()}.${pipeline.extension}`;
      const file = new FileInfo(filename);
      file.save(buffer);
      log.debug(`Written data to: ${filename}`);
      return {};

    } else if (request.batch && request.page > 0) {
      const buffer = await Process.spawn(Scanimage.scan(request));
      const number = `000${request.page}`.slice(-4);
      const filename = `${stem}${number}.tif`;
      const file = new FileInfo(filename);
      file.save(buffer);
      log.debug(`Written data to: ${filename}`);
      return {
        page: request.page + 1
      };

    } else {
      const pipeline = context.pipelines.filter(p => p.description === request.pipeline)[0];
      const cmds = [`ls ${stem}*.tif`].concat(pipeline.commands);
      log.debug('Executing cmds:', cmds);
      const buffer = await Process.chain(cmds);
      const filename = `${Config.outputDirectory}${Config.filename()}.${pipeline.extension}`;
      const file = new FileInfo(filename);
      file.save(buffer);
      log.debug(`Written data to: ${filename}`);
      return {};
    }
  }

  static async context(force) {
    if (force) {
      Device.reset();
      const preview = new FileInfo(`${Config.previewDirectory}preview.tif`);
      preview.delete();
    }
    return await Context.create();
  }
}

module.exports = Api;