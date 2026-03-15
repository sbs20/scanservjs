const log = require('loglevel').getLogger('ScanController');
const Constants = require('./constants');
const Collator = require('./classes/collator');
const CommandBuilder = require('./classes/command-builder');
const FileInfo = require('./classes/file-info');
const Process = require('./classes/process');
const Request = require('./classes/request');
const Zip = require('./classes/zip');

const application = require('./application');
const userOptions = application.userOptions();
const config = application.config();
const scanimageCommand = application.scanimageCommand();

class ScanController {
  constructor() {
    /** @type {Context} */
    this.context = null;

    /** @type {ScanRequest} */
    this.request = null;

    this.dir = FileInfo.create(config.tempDirectory);
  }

  /**
   * @param {ScanRequest} req
   */
  async init(req) {
    this.context = await application.context();
    this.request = new Request(this.context, req);
    this.pipeline = config.pipelines
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
    await Process.spawn(scanimageCommand.scan(this.request));
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

    // Apply transformations (rotation, flip)
    if (this.request.transformations) {
      const transformParams = ScanController._buildTransformParams(config, this.request, this.request.transformations);
      if (transformParams) {
        const stdin = files.map(f => `${f.name}\n`).join('');
        const cmd = `convert @- ${transformParams} t-%04d.tif`;
        await Process.spawn(cmd, stdin, { cwd: config.tempDirectory });
        files = (await this.listFiles()).filter(f => f.name.match(/t-\d{4}\.tif/));
      }
    }

    // Apply filters
    if (this.request.filters.length > 0) {
      const stdin = files.map(f => `${f.name}\n`).join('');
      const cmd = `convert @- ${application.filterBuilder().build(this.request.filters)} f-%04d.tif`;
      await Process.spawn(cmd, stdin, { cwd: config.tempDirectory });
      files = (await this.listFiles()).filter(f => f.name.match(/f-\d{4}\.tif/));
    }

    const stdin = files.map(f => `${f.name}\n`).join('');
    log.debug('Executing cmds:', this.pipeline.commands);
    const stdout = await Process.chain(this.pipeline.commands, stdin, { cwd: config.tempDirectory });
    let filenames = stdout.toString().split('\n').filter(f => f.length > 0);

    let filename = filenames[0];
    let extension = this.pipeline.extension;
    if (filenames.length > 1) {
      filename = 'archive.zip';
      extension = 'zip';
      Zip.file(`${config.tempDirectory}/${filename}`)
        .deflate(filenames.map(f => `${config.tempDirectory}/${f}`));
    }

    const destination = `${config.outputDirectory}/${config.filename()}.${extension}`;
    await FileInfo
      .create(`${config.tempDirectory}/${filename}`)
      .move(destination);

    log.debug({output: destination});
    await this.deleteFiles();

    const fileInfo = FileInfo.create(destination);
    if ('afterAction' in this.pipeline) {
      userOptions.action(this.pipeline.afterAction).execute(fileInfo);
    }

    return fileInfo;
  }

  /**
   * @returns {Promise.<Buffer>}
   */
  async imageAsBuffer() {
    const filepath = scanimageCommand.filename(this.request.index);
    let buffer = FileInfo.create(filepath).toBuffer();
    buffer = await Process.chain(config.previewPipeline.commands, buffer, { ignoreErrors: true });
    return buffer;
  }

  /**
   * Build ImageMagick transformation parameters
   * @param {Object} transformations
   * @returns {string}
   */
  static _buildTransformParams(config, request, transformations) {
    if (!transformations) {
      return '';
    }

    const params = [];

    if (transformations.magic) {
        let offsetX = 0;
        let offsetY = 0;
        let width = 0;
        let height = 0;
        if (request && request.params) {
            offsetX = parseFloat(request.params['-l'] || request.params.left) || 0;
            offsetY = parseFloat(request.params['-t'] || request.params.top) || 0;
            width = parseFloat(request.params['-x'] || request.params.width) || 0;
            height = parseFloat(request.params['-y'] || request.params.height) || 0;
        }
        let magic = transformations.magic;
        magic = magic.replace(/{OX}/g, offsetX);
        magic = magic.replace(/{OY}/g, offsetY);
        magic = magic.replace(/{IW}/g, width);
        magic = magic.replace(/{IH}/g, height);
        magic = magic.replace(/{TW}/g, width);
        magic = magic.replace(/{TH}/g, height);
        // Safety for legacy placeholders
        magic = magic.replace(/{TCX}/g, '0');
        magic = magic.replace(/{TCY}/g, '0');
        params.push(magic);

        // Surgical crop to remove AABB padding in the final scan
        if (transformations.width && transformations.height) {
          const res = request.params.resolution || 300;
          const w_px = Math.round(parseFloat(transformations.width) * res / 25.4);
          const h_px = Math.round(parseFloat(transformations.height) * res / 25.4);
          params.push(`-gravity center -extent ${w_px}x${h_px} +repage`);
        }
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
   * Creates a preview image from a scan. This is less trivial because we need
   * to accommodate the possibility of cropping
   * @param {string} filename
   * @returns {Promise.<void>}
   */
  async updatePreview(filename) {
    const device = this.context.getDevice(this.request.params.deviceId);
    const cmdBuilder = new CommandBuilder(config.convert)
      .arg(`${config.tempDirectory}/${filename}`);

    const width = 868;
    if (device.geometry) {
      const scale = width / device.features['-x'].limits[1];
      const height = Math.round(device.features['-y'].limits[1] * scale);
      const left = Math.round(this.request.params.left * scale);
      const top = Math.round(this.request.params.top * scale);
      const scaleWidth = Math.round(this.request.params.width * scale);
      cmdBuilder.arg('-scale', scaleWidth)
        .arg('-background', 'white')
        .arg('-extent', `${width}x${height}-${left}-${top}`);
    } else {
      cmdBuilder.arg('-scale', width);
    }

    cmdBuilder.arg(`${config.previewDirectory}/preview.tif`);

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
      await userOptions.afterScan(file);
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
  async run(req) {
    const scan = new ScanController();
    return await scan.execute(req);
  }
};
