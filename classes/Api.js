var dateFormat = require('dateformat');
var fs = require('fs');
var Q = require('kew');

var Config = require('./Config');
var Device = require('./Device');
var FileInfo = require('./FileInfo');
var ScanRequest = require('./ScanRequest');
var Scanimage = require('./Scanimage');
var Convert = require('./Convert');
var FinishMerge = require('./FinishMerge');

module.exports = function () {
    var _this = this;

    _this.fileList = function () {
        var deferred = Q.defer();
        var outdir = Config.OutputDirectory;

        fs.readdir(outdir, function (err, list) {
            if (err) {
                deferred.reject(err);
            }

            var files = list.map(function (f) {
                return new FileInfo(outdir + f);
            }).filter(function (f) {
                return f.extension === '.tif' || f.extension === '.jpg' || f.extension === '.pdf';
            });

            deferred.resolve(files);
        });

        return deferred.promise;
    };

    _this.fileDelete = function (req) {
        var f = new FileInfo(req.data);
        return Q.resolve(f.delete());
    };

    _this.convert = function () {
        var options = {
            source: Config.PreviewDirectory + 'preview.tif',
            target: Config.PreviewDirectory + 'preview.jpg',
            trim: false
        };

        var convert = new Convert(options);

        // Ignore errors. The FileInfo will either exist or not
        return convert.execute()
            .then(function () {
                var fileInfo = new FileInfo(options.target);
                if (!fileInfo.exists()) {
                    throw new Error("File does not exist");
                }
                return fileInfo;
            });
    };

    _this.scan = function (req) {
        var scanRequest = new ScanRequest(req);
        var scanner = new Scanimage();
        return scanner.execute(scanRequest);
    };

    _this.finishMerge = function (req) {
        var dateString = dateFormat(new Date(), 'yyyy-mm-dd HH.MM.ss');
        var outputFilepath = Config.OutputDirectory + 'scan_' + dateString;
        
        var options = {
            target: outputFilepath,
            pages: req.pages,
            ocr: req.ocr
        };
        var finishMerge = new FinishMerge(options);
        return finishMerge.execute()
            .then(function () {
                var fileInfo = new FileInfo(options.target + '.pdf');
                if (!fileInfo.exists()) {
                    throw new Error("File does not exist");
                }
                return fileInfo;
            });
    };

    _this.preview = function (req) {
        var scanRequest = new ScanRequest({
            device: req.device,
            mode: req.mode,
            brightness: req.brightness,
            contrast: req.contrast,
            dynamicLineart: req.dynamicLineart,
            outputFilepath: Config.PreviewDirectory + 'preview.tif',
            resolution: Config.PreviewResolution
        });

        var scanner = new Scanimage();
        return scanner.execute(scanRequest);
    };

    var testFileExists = function (path) {
        var file = new FileInfo(path);
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
    };

    _this.diagnostics = function () {
        var tests = [];

        tests.push(testFileExists(Config.Scanimage));
        tests.push(testFileExists(Config.Convert));
        tests.push(testFileExists(Config.Tesseract));

        return Q.resolve(tests);
    };

    _this.device = function () {
        return new Device().get();
    };
};