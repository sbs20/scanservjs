const fs = require('fs');
const log = require('loglevel').getLogger('Api');

const Config = require('../config/config');
const Convert = require('./Convert');
const Device = require('./Device');
const FileInfo = require('./FileInfo');
const ScanRequest = require('./ScanRequest');
const Scanimage = require('./Scanimage');
const System = require('./System');

function testFileExists(path) {
  if (System.fileExists(path)) {
    return {
      success: true,
      message: `Found ${path}`
    };
  }

  return {
    success: false,
    message: `Unable to find ${path}`
  };
}

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
          .filter(f => f.extension === '.tif' || f.extension === '.jpg' || f.extension === '.pdf');

        log.debug(files);
        resolve(files);
      });
    });
  }

  static fileDelete(fullpath) {
    const file = new FileInfo(fullpath);
    return file.delete();
  }

  static async convert() {
    let options = {
      default: Config.previewDirectory + 'default.jpg',
      source: Config.previewDirectory + 'preview.tif',
      target: Config.previewDirectory + 'preview.jpg',
      trim: false
    };

    let source = new FileInfo(options.source);
    if (!source.exists()) {
      return new FileInfo(options.default);
    }
  
    const convert = new Convert(options);
    await convert.execute();
    let fileInfo = new FileInfo(options.target);
    if (!fileInfo.exists()) {
      throw new Error('File does not exist');
    }
    return fileInfo;
  }

  static async scan(req) {
    let scanRequest = new ScanRequest(req);
    let scanimage = new Scanimage();
    return await scanimage.execute(scanRequest);
  }

  static async preview(req) {
    let scanRequest = new ScanRequest({
      device: req.device,
      mode: req.mode,
      brightness: req.brightness,
      contrast: req.contrast,
      dynamicLineart: req.dynamicLineart
    });

    scanRequest.outputFilepath = Config.previewDirectory + 'preview.tif';
    scanRequest.resolution = Config.previewResolution;

    let scanimage = new Scanimage();
    return await scanimage.execute(scanRequest);
  }

  static diagnostics() {
    let tests = [];
    tests.push(testFileExists(Config.scanimage));
    tests.push(testFileExists(Config.convert));
    return tests;  
  }

  static async device(force) {
    if (force) {
      Device.reset();
    }
    return await Device.get();
  }
}

module.exports = Api;