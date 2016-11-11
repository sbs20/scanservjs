var dateFormat = require('dateformat');
var fs = require('fs');
var Q = require('kew');

var Config = require('./Config');
var System = require('./System');
var FileInfo = require('./FileInfo');
var ScanRequest = require('./ScanRequest');
var Scanimage = require('./Scanimage');

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
                return f.extension === '.tif';
            });

            deferred.resolve(files);
        });

        return deferred.promise;
    };

    _this.fileDelete = function (req) {
        var f = new FileInfo(req.data);
        return Q.resolve(f.delete());
    };

    _this.previewToJpeg = function () {
        var cmd = Config.Convert +
            ' ' +
            Config.PreviewDirectory +
            'preview.tif ' +
            Config.PreviewDirectory +
            'preview.jpg';

        return System.execute(cmd);
    };

    _this.scan = function (req) {
        var dateString = dateFormat(new Date(), 'yyyy-mm-dd HH.MM.ss');
        System.extend(req.data, { outputFilepath: Config.OutputDirectory + 'Scan_' + dateString + '.tif' });
        var scanRequest = new ScanRequest(req.data);
        var scanner = new Scanimage();
        return scanner.execute(scanRequest);
    };

    _this.preview = function (req) {
        var scanRequest = new ScanRequest({
            outputFilepath: Config.PreviewDirectory + 'preview.tif',
            resolution: 50
        });

        var scanner = new Scanimage();
        return scanner.execute(scanRequest);
    };

    _this.handleRequest = function (params) {
        var type = params.type;
        var output = null;

        switch (type) {
            case "scan":
                output = _this.scan(params);
                break;

            case "preview":
                output = _this.preview(params);
                break;

            case "fileList":
                output = _this.fileList();
                break;

            case "fileDelete":
                output = _this.fileDelete(params);
                break;

            case "previewToJpeg":
                output = _this.previewToJpeg();
                break;

            case "cmdline":
                // $responseData = self::HandleCmdlineRequest($request);
                output = Q.reject("cmdline is disabled. If you wish to debug httpdusr permissions you will need to manually enable this in the source.");
                break;

            case "ping":
                output = Q.resolve('Pong@' + new Date().toISOString());
                break;

            default:
                type = "unknown";
                output = Q.reject();
                break;
        }

        var deferred = Q.defer();

        output.promise.then(function (data) {
            deferred.resolve({
                type: type,
                data: data
            });
        });

        return deferred.promise;
    };
};