const log = require('loglevel').getLogger('ScanController');
const Constants = require('./constants');
const Collator = require('./classes/collator');
const CommandBuilder = require('./classes/command-builder');
const FileInfo = require('./classes/file-info');
const Process = require('./classes/process');
const Request = require('./classes/request');
const Zip = require('./classes/zip');

class ScanController {
  constructor(application) {
    this.application = application;

    /** @type {Context} */
    this.context = null;

    /** @type {ScanRequest} */
    this.request = null;

    this.dir = FileInfo.create(this.application.config.tempDirectory);
  }

  /**
   * @param {ScanRequest} req
   */
  async init(req) {
    this.context = await this.application.context();
    this.request = new Request(this.context, req);
    this.pipeline = this.application.config.pipelines
      .filter(p => p.description === this.request.pipeline)[0];
    if (this.pipeline === undefined) {
      throw Error('No matching pipeline');
    }

    this.firstPass = this.request.index === 1;
    this.performScan = this.request.index > 0;
    this.finishUp = [Constants.BATCH_AUTO, Constants.BATCH_NONE].includes(this.request.batch)
      || (this.request.batch === Constants.BATCH_MANUAL && this.request.index < 0)
      || (this.request.batch === Constants.BATCH_COLLATE_STANDARD && this.request.index === 2)
      || (this.request.batch === Constants.BATCH_COLLATE_REVERSE && this.request.index === 2);
  }

  /**
   * @returns {Promise.<FileInfo[]>}
   */
  async listFiles() {
    const files = await this.dir.list();
    return files.sort((f1, f2) => f1.name.localeCompare(f2.name));
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
    log.info('Scanning');
    await Process.spawn(this.application.scanimageCommand.scan(this.request));
  }

  /**
   * @returns {Promise.<FileInfo>}
   */
  async finish() {
    log.debug(`Post processing: ${this.pipeline.description}`);
    let files = (await this.listFiles()).filter(f => f.extension === '.tif');

    // Update preview with the first image (pre filter)
    await this.updatePreview(files[0].name);

    // Collation
    if ([Constants.BATCH_COLLATE_STANDARD, Constants.BATCH_COLLATE_REVERSE].includes(this.request.batch)) {
      files = Collator.collate(files, this.request.batch === Constants.BATCH_COLLATE_STANDARD);
    }

    // Apply filters
    if (this.request.filters.length > 0) {
      const stdin = files.map(f => `${f.name}\n`).join('');
      const cmd = `convert @- ${this.application.filterBuilder().build(this.request.filters)} f-%04d.tif`;
      await Process.spawn(cmd, stdin, { cwd: this.application.config.tempDirectory });
      files = (await this.listFiles()).filter(f => f.name.match(/f-\d{4}\.tif/));
    }

    const stdin = files.map(f => `${f.name}\n`).join('');
    log.debug('Executing cmds:', this.pipeline.commands);
    const stdout = await Process.chain(this.pipeline.commands, stdin, { cwd: this.application.config.tempDirectory });
    let filenames = stdout.toString().split('\n').filter(f => f.length > 0);

    let filename = filenames[0];
    let extension = this.pipeline.extension;
    if (filenames.length > 1) {
      filename = 'archive.zip';
      extension = 'zip';
      Zip.file(`${this.application.config.tempDirectory}/${filename}`)
        .deflate(filenames.map(f => `${this.application.config.tempDirectory}/${f}`));
    }

    const destination = `${this.application.config.outputDirectory}/${this.application.config.filename()}.${extension}`;
    await FileInfo
      .create(`${this.application.config.tempDirectory}/${filename}`)
      .move(destination);

    log.debug({output: destination});
    await this.deleteFiles();

    const fileInfo = FileInfo.create(destination);
    if ('afterAction' in this.pipeline) {
      this.application.userOptions.action(this.pipeline.afterAction).execute(fileInfo);
    }

    return fileInfo;
  }

  /**
   * @returns {Promise.<Buffer>}
   */
  async imageAsBuffer() {
    const filepath = this.application.scanimageCommand.filename(this.request.index);
    let buffer = FileInfo.create(filepath).toBuffer();
    buffer = await Process.chain(this.application.config.previewPipeline.commands, buffer, { ignoreErrors: true });
    return buffer;
  }

  /**
   * Creates a preview image from a scan. This is less trivial because we need
   * to accommodate the possibility of cropping
   * @param {string} filename
   * @returns {Promise.<void>}
   */
  async updatePreview(filename) {
    const device = this.context.getDevice(this.request.params.deviceId);
    const cmdBuilder = new CommandBuilder(this.application.config.convert)
      .arg(`${this.application.config.tempDirectory}/${filename}`);

    const width = 868;
    if (device.geometry) {
      const scale = width / device.features['-x'].limits[1];
      const height = Math.round(device.features['-y'].limits[1] * scale);
      const left = Math.round(this.request.params.left * scale);
      const top = Math.round(this.request.params.top * scale);
      const scaleWidth = Math.round(this.request.params.width * scale);
      cmdBuilder.arg('-scale', scaleWidth)
        .arg('-background', '#808080')
        .arg('-extent', `${width}x${height}-${left}-${top}`);
    } else {
      cmdBuilder.arg('-scale', width);
    }

    cmdBuilder.arg(`${this.application.config.previewDirectory}/preview.tif`);

    await Process.spawn(cmdBuilder.build());
  }

  /**
   * @param {ScanRequest} req
   * @returns {Promise.<ScanResponse>}
   */
  async execute(req) {
    await this.init(req);

    if (this.firstPass) {
      await this.deleteFiles();
    }

    if (this.performScan) {
      await this.scan();
    }

    if (this.finishUp) {
      const file = await this.finish();
      await this.application.userOptions.afterScan(file);
      return {
        file
      };

    } else {
      log.info(`Finished pass: ${this.request.index}`);
      /** @type {ScanResponse} */
      const response = { index: this.request.index };
      if (this.request.batch === Constants.BATCH_MANUAL) {
        response.image = (await this.imageAsBuffer()).toString('base64');
      }
      return response;
    }
  }
}

module.exports = {
  /**
   * @param {ScanRequest} req
   * @returns {Promise.<ScanResponse>}
   */
  async run(application, req) {
    const scan = new ScanController(application);
    return await scan.execute(req);
  }
};
