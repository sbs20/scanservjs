var dateFormat = require('dateformat');
var fs = require('fs');
var Q = require('kew');

var Config = require('./Config');
var System = require('./System');
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

    var testFileExists = function (path, critical) {
        var file = new FileInfo(path);
        if (file.exists()) {
            return {
                success: true,
                key: file.name,
                message: 'Found ' + file.name + ' at "' + path + '"'
            };
        }

        return {
            success: false,
            critical: critical,
            key: file.name,
            message: 'Unable to find ' + file.name + ' at "' + path + '"'
        };
    };

    var testTesseractLanguage = function (path, language, critical) {
        var cmd = path;
        cmd += ' --list-langs';

        return System.execute(cmd)
            .then(function (reply) {
                var lines = reply.output.split('\n');
                lines.shift(); // remove "List of available languages (n):\n"
                lines.pop(); // remove element created by last '\n'

                if (lines.includes(language)) {
                    return {
                        success: true,
                        key: 'tesseract-lang',
                        message: 'Selected language ' + language + ' is available in tesseract'
                    };
                } else {
                    return {
                        success: false,
                        critical: critical,
                        key: 'tesseract-lang',
                        message: 'Selected language ' + language + ' is not available in tesseract'
                    };
                }
            })
            .fail(function (data) {
                console.log(data);

                return {
                    success: false,
                    critical: critical,
                    key: 'tesseract-lang',
                    message: 'Cannot execute tesseract'
                };
            });
    };

    _this.diagnostics = function () {
        var tests = [];

        tests.push(Q.resolve(testFileExists(Config.Scanimage, true)));
        tests.push(Q.resolve(testFileExists(Config.Convert, true)));

        var tesseractResult = testFileExists(Config.Tesseract, false);
        tests.push(Q.resolve(tesseractResult));

        if (tesseractResult.success) {
            tests.push(testTesseractLanguage(Config.Tesseract, Config.TesseractLanguage, true));
        };

        return Q.all(tests);
    };

    _this.device = function () {
        return new Device().get();
    };
};