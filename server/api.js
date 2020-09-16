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
          .filter(f => ['.tif', '.jpg', '.png', '.pdf'].includes(f.extension))
          .sort((f1, f2) => f2.lastModified - f1.lastModified);

        log.debug(files);
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
    const source = new FileInfo(`${Config.previewDirectory}preview.tif`);
    if (!source.exists()) {
      return new FileInfo(`${Config.previewDirectory}default.jpg`).toBuffer();
    }
  
    const buffer = source.toBuffer();
    return await Process.chain(Config.previewPipeline.commands, buffer, true);
  }

  static async scan(req) {
    const context = await Context.create();
    const request = new Request(context).extend(req);
    const pipeline = context.pipelines.filter(p => p.description === request.pipeline)[0];
    const cmds = [Scanimage.scan(request)].concat(pipeline.commands);

    log.debug('Executing cmds:', cmds);
    const buffer = await Process.chain(cmds);
    const filename = `${Config.outputDirectory}${Config.filename()}.${pipeline.extension}`;
    const file = new FileInfo(filename);
    file.save(buffer);
    log.debug(`Written data to: ${filename}`);

    return {};
  }

  static async context(force) {
    if (force) {
      Device.reset();
    }
    return await Context.create();
  }
}

module.exports = Api;