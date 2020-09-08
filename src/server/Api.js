const fs = require('fs');

const Constants = require('./Constants');
const Device = require('./Device');
const FileInfo = require('./FileInfo');
const ScanRequest = require('./ScanRequest');
const Scanimage = require('./Scanimage');
const Convert = require('./Convert');

function testFileExists(path) {
  let file = new FileInfo(path);
  if (file.exists()) {
    return {
      success: true,
      message: 'Found ' + file.name + ' at "' + path + '"'
    };
  }

  return {
    success: false,
    message: 'Unable to find ' + file.name + ' at "' + path + '"'
  };
}

class Api {
  static async fileList() {
    return await new Promise((resolve, reject) => {
      let outdir = Constants.OutputDirectory;
      fs.readdir(outdir, (err, list) => {
        if (err) {
          reject(err);
        }
  
        let files = list
          .map(f => new FileInfo(outdir + f))
          .filter(f => f.extension === '.tif' || f.extension === '.jpg' || f.extension === '.pdf');
  
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
      default: Constants.PreviewDirectory + 'default.jpg',
      source: Constants.PreviewDirectory + 'preview.tif',
      target: Constants.PreviewDirectory + 'preview.jpg',
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

    scanRequest.outputFilepath = Constants.PreviewDirectory + 'preview.tif';
    scanRequest.resolution = Constants.PreviewResolution;

    let scanimage = new Scanimage();
    return await scanimage.execute(scanRequest);
  }

  static diagnostics() {
    let tests = [];
    tests.push(testFileExists(Constants.Scanimage));
    tests.push(testFileExists(Constants.Convert));
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