const fs = require('fs');
const Q = require('kew');

const Config = require('./Config');
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
  fileList() {
    let deferred = Q.defer();
    let outdir = Config.OutputDirectory;

    fs.readdir(outdir, (err, list) => {
      if (err) {
        deferred.reject(err);
      }

      let files = list.map((f) => {
        return new FileInfo(outdir + f);
      }).filter((f) => {
        return f.extension === '.tif' || f.extension === '.jpg' || f.extension === '.pdf';
      });

      deferred.resolve(files);
    });

    return deferred.promise;
  }

  fileDelete(req) {
    let f = new FileInfo(req.data);
    return Q.resolve(f.delete());
  }

  convert() {
    let options = {
      default: Config.PreviewDirectory + 'default.jpg',
      source: Config.PreviewDirectory + 'preview.tif',
      target: Config.PreviewDirectory + 'preview.jpg',
      trim: false
    };

    let source = new FileInfo(options.source);
    if (!source.exists()) {
      let fileInfo = new FileInfo(options.default);
      return Q.resolve(fileInfo);
    }

    let convert = new Convert(options);

    // Ignore errors. The FileInfo will either exist or not
    return convert.execute()
      .then(() => {
        let fileInfo = new FileInfo(options.target);
        if (!fileInfo.exists()) {
          throw new Error('File does not exist');
        }
        return fileInfo;
      });
  }

  scan(req) {
    let scanRequest = new ScanRequest(req);
    let scanner = new Scanimage();
    return scanner.execute(scanRequest);
  }

  preview(req) {
    let scanRequest = new ScanRequest({
      device: req.device,
      mode: req.mode,
      brightness: req.brightness,
      contrast: req.contrast,
      dynamicLineart: req.dynamicLineart
    });

    scanRequest.outputFilepath = Config.PreviewDirectory + 'preview.tif';
    scanRequest.resolution = Config.PreviewResolution;

    let scanner = new Scanimage();
    return scanner.execute(scanRequest);
  }

  diagnostics() {
    let tests = [];
    tests.push(testFileExists(Config.Scanimage));
    tests.push(testFileExists(Config.Convert));
    return Q.resolve(tests);
  }

  device() {
    return new Device().get();
  }
}

module.exports = Api;