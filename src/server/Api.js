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
  static fileList() {
    return new Promise((resolve, reject) => {
      let outdir = Constants.OutputDirectory;
      fs.readdir(outdir, (err, list) => {
        if (err) {
          reject(err);
        }
  
        let files = list.map((f) => {
          return new FileInfo(outdir + f);
        }).filter((f) => {
          return f.extension === '.tif' || f.extension === '.jpg' || f.extension === '.pdf';
        });
  
        resolve(files);
      });
    });
  }

  static fileDelete(req) {
    return new Promise(resolve => {
      const file = new FileInfo(req.data);
      resolve(file.delete());
    });
  }

  static convert() {
    let options = {
      default: Constants.PreviewDirectory + 'default.jpg',
      source: Constants.PreviewDirectory + 'preview.tif',
      target: Constants.PreviewDirectory + 'preview.jpg',
      trim: false
    };

    return new Promise(resolve => {
      let source = new FileInfo(options.source);
      if (!source.exists()) {
        let fileInfo = new FileInfo(options.default);
        resolve(fileInfo);
      }
  
      let convert = new Convert(options);
  
      // Ignore errors. The FileInfo will either exist or not
      return convert.execute()
        .then(() => {
          let fileInfo = new FileInfo(options.target);
          if (!fileInfo.exists()) {
            throw new Error('File does not exist');
          }
          resolve(fileInfo);
        });  
    });
  }

  static scan(req) {
    let scanRequest = new ScanRequest(req);
    let scanner = new Scanimage();
    return scanner.execute(scanRequest);
  }

  static preview(req) {
    let scanRequest = new ScanRequest({
      device: req.device,
      mode: req.mode,
      brightness: req.brightness,
      contrast: req.contrast,
      dynamicLineart: req.dynamicLineart
    });

    scanRequest.outputFilepath = Constants.PreviewDirectory + 'preview.tif';
    scanRequest.resolution = Constants.PreviewResolution;

    let scanner = new Scanimage();
    return scanner.execute(scanRequest);
  }

  static diagnostics() {
    return new Promise(resolve => {
      let tests = [];
      tests.push(testFileExists(Constants.Scanimage));
      tests.push(testFileExists(Constants.Convert));
      resolve(tests);  
    });
  }

  static device() {
    return new Device().get();
  }
}

module.exports = Api;