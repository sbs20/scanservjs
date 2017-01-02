var dateFormat = require('dateformat');
var fs = require('fs');
var Q = require('kew');

var Config = require('./Config');
var System = require('./System');
var FileInfo = require('./FileInfo');
var ScanRequest = require('./ScanRequest');
var Scanimage = require('./Scanimage');
var Convert = require('./Convert');

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
                return f.extension === '.tif' || f.extension === '.jpg';
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
                if (!fileInfo.exists()) throw new Error("File does not exist");
                return fileInfo;
            });
    };

    _this.scan = function (req) {
        var dateString = dateFormat(new Date(), 'yyyy-mm-dd HH.MM.ss');
        System.extend(req, {
            outputFilepath: Config.OutputDirectory + 'Scan_' + dateString + '.tif'
        });

        var scanRequest = new ScanRequest(req);
        var scanner = new Scanimage();
        return scanner.execute(scanRequest);
    };

    _this.preview = function (req) {
        var scanRequest = new ScanRequest({
            mode: req.mode,
            brightness: req.brightness,
            contrast: req.contrast,
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

        return Q.resolve(tests);
    };
};