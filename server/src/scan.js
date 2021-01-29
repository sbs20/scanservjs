const log = require('loglevel').getLogger('Scan');
const CmdBuilder = require('./command-builder');
const Config = require('../config/config');
const Constants = require('./constants');
const Context = require('./context');
const FileInfo = require('./file-info');
const Process = require('./process');
const Request = require('./request');
const Scanimage = require('./scanimage');
const Util = require('./util');

class Scan {

  constructor() {
    /** @type {Context} */
    this.context = null;

    /** @type {Request} */
    this.request = null;
  }

  /**
   * Creates a preview image from a scan. This is less trivial because we need
   * to accommodate the possibility of cropping
   * @param {Context} context 
   * @param {ScanRequest} request 
   * @param {string} filename 
   * @returns {Promise.<void>}
   */
  static async updatePreview(context, request, filename) {
    const dpmm = request.params.resolution / 25.4;
    const device = context.getDevice(request.params.deviceId);
    const geometry = {
      width: device.features['-x'].limits[1] * dpmm,
      height: device.features['-y'].limits[1] * dpmm,
      left: request.params.left * dpmm,
      top: request.params.top * dpmm
    };

    const cmd = new CmdBuilder(Config.convert)
      .arg(`'${Config.tempDirectory}${filename}'`)
      .arg('-background', '#808080')
      .arg('-extent', `${geometry.width}x${geometry.height}-${geometry.left}-${geometry.top}`)
      .arg('-resize', 868)
      .arg(`'${Config.previewDirectory}preview.tif'`)
      .build();

    await Process.spawn(cmd);
  }

  /**
   * @param {ScanRequest} req 
   * @returns {Promise.<ScanResponse>}
   */
  static async run(req) {
    const context = await Context.create();
    const request = new Request(context).extend(req);
    const dir = FileInfo.create(Config.tempDirectory);

    // Check pipeline here. Better to find out sooner if there's a problem
    const pipeline = context.pipelines.filter(p => p.description === request.pipeline)[0];
    if (pipeline === undefined) {
      throw Error('No matching pipeline');
    }

    const clearTemp = async () => {
      const files = await dir.list();
      files.map(f => f.delete());
    };

    if (request.index === 1) {
      log.debug('Clearing temp directory');
      await clearTemp();
    }

    if (request.index > 0) {
      log.debug('Scanning');
      await Process.spawn(Scanimage.scan(request));
    }

    if (request.batch !== Constants.BATCH_MANUAL || request.index < 1) {
      log.debug(`Post processing: ${pipeline.description}`);
      const files = (await dir.list())
        .filter(f => f.extension === '.tif');

      // Update preview with the first image
      await Scan.updatePreview(context, request, files[0].name);

      const stdin = files
        .map(f => f.name)
        .join('\n');
      log.debug('Executing cmds:', pipeline.commands);
      const stdout = await Process.chain(pipeline.commands, stdin, { cwd: Config.tempDirectory });
      let filenames = stdout.toString().split('\n').filter(f => f.length > 0);

      let filename = filenames[0];
      let extension = pipeline.extension;
      if (filenames.length > 1) {
        filename = 'archive.zip';
        extension = 'zip';
        Util.zip(
          filenames.map(f => `${Config.tempDirectory}${f}`),
          `${Config.tempDirectory}${filename}`);
      }

      const destination = `${Config.outputDirectory}${Config.filename()}.${extension}`;
      await FileInfo
        .create(`${Config.tempDirectory}${filename}`)
        .move(destination);

      log.debug(`Written data to: ${destination}`);
      await clearTemp();
      return {};
    }

    // Manual batch scan
    const filepath = Scanimage.filename(request.index);
    let buffer = FileInfo.create(filepath).toBuffer();
    buffer = await Process.chain(Config.previewPipeline.commands, buffer, { ignoreErrors: true });

    log.debug(`Finished page: ${request.index}`);
    return {
      index: request.index,
      image: buffer.toString('base64')
    };
  }
}

module.exports = Scan;