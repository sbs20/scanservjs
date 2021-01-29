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

class ScanController {
  constructor() {
    /** @type {Context} */
    this.context = null;

    /** @type {Request} */
    this.request = null;

    this.dir = FileInfo.create(Config.tempDirectory);
  }

  /**
   * @param {ScanRequest} req 
   */
  async init(req) {
    this.context = await Context.create();
    this.request = new Request(this.context).extend(req);
    // Check pipeline here. Better to find out sooner if there's a problem
    this.pipeline = this.context.pipelines.filter(
      p => p.description === this.request.pipeline)[0];
    if (this.pipeline === undefined) {
      throw Error('No matching pipeline');
    }
  }

  /**
   * @returns {Promise.<FileInfo[]>}
   */
  async listFiles() {
    return await this.dir.list();
  }

  /**
   * @returns {Promise.<void>}
   */
  async deleteFiles() {
    (await this.listFiles()).map(f => f.delete());
  }

  /**
   * @returns {Promise.<void>}
   */
  async scan() {
    log.debug('Scanning');
    await Process.spawn(Scanimage.scan(this.request));
  }

  /**
   * @returns {Promise.<void>}
   */
  async finish() {
    log.debug(`Post processing: ${this.pipeline.description}`);
    const files = (await this.listFiles()).filter(f => f.extension === '.tif');

    // Update preview with the first image
    await this.updatePreview(files[0].name);

    const stdin = files.map(f => f.name).join('\n');
    log.debug('Executing cmds:', this.pipeline.commands);
    const stdout = await Process.chain(this.pipeline.commands, stdin, { cwd: Config.tempDirectory });
    let filenames = stdout.toString().split('\n').filter(f => f.length > 0);

    let filename = filenames[0];
    let extension = this.pipeline.extension;
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
    await this.deleteFiles();
  }

  /**
   * @returns {Promise.<Buffer>}
   */
  async imageAsBuffer() {
    const filepath = Scanimage.filename(this.request.index);
    let buffer = FileInfo.create(filepath).toBuffer();
    buffer = await Process.chain(Config.previewPipeline.commands, buffer, { ignoreErrors: true });
    return buffer;
  }

  /**
   * Creates a preview image from a scan. This is less trivial because we need
   * to accommodate the possibility of cropping
   * @param {string} filename 
   * @returns {Promise.<void>}
   */
  async updatePreview(filename) {
    const dpmm = this.request.params.resolution / 25.4;
    const device = this.context.getDevice(this.request.params.deviceId);
    const geometry = {
      width: device.features['-x'].limits[1] * dpmm,
      height: device.features['-y'].limits[1] * dpmm,
      left: this.request.params.left * dpmm,
      top: this.request.params.top * dpmm
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
   * @returns {Promise.<ScanResponse>}
   */
  async execute() {
    if (this.request.index === 1) {
      await this.deleteFiles();
    }

    if (this.request.index > 0) {
      await this.scan();
    }

    if (this.request.batch !== Constants.BATCH_MANUAL || this.request.index < 1) {
      await this.finish();
      return {};
    }

    log.debug(`Finished page: ${this.request.index}`);
    return {
      index: this.request.index,
      image: (await this.imageAsBuffer()).toString('base64')
    };
  }
}

module.exports = {
  /**
   * @param {ScanRequest} req 
   * @returns {Promise.<ScanResponse>}
   */
  async run(req) {
    const scan = new ScanController();
    await scan.init(req);
    return await scan.execute();
  }
};