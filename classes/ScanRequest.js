var dateFormat = require('dateformat');
var Config = require('./Config');
var System = require('./System');

var ScanRequest = function (def) {
    var _this = this;

    System.extend(_this, ScanRequest.default, def);
    if (!_this.outputFilepath) {
        var dateString = dateFormat(new Date(), 'yyyy-mm-dd HH.MM.ss');
        _this.outputFilepath = Config.OutputDirectory + 'scan_' + dateString + '.' +
            // for scanning as PDF, save a TIF first and convert it later
            (_this.convertFormat === 'pdf' ? "tif" : _this.convertFormat);
    }

    _this.validate = function () {
        var errors = [];

        if (_this.mode === undefined) {
            errors.push('Invalid mode: ' + _this.mode);
        }

        if (!Number.isInteger(_this.width)) {
            errors.push('Invalid width: ' + _this.width);
        }

        if (!Number.isInteger(_this.height)) {
            errors.push('Invalid height: ' + _this.height);
        }

        if (!Number.isInteger(_this.top)) {
            errors.push('Invalid top: ' + _this.top);
        }

        if (!Number.isInteger(_this.left)) {
            errors.push('Invalid left: ' + _this.left);
        }

        if (!Number.isInteger(_this.brightness)) {
            errors.push('Invalid brightness: ' + _this.brightness);
        }

        if (!Number.isInteger(_this.contrast)) {
            errors.push('Invalid contrast: ' + _this.contrast);
        }

        if ('depth' in _this && !Number.isInteger(_this.depth)) {
            errors.push('Invalid depth: ' + _this.depth);
        }

        if (_this.top + _this.height > Config.MaximumScanHeightInMm) {
            errors.push('Top + height exceed maximum dimensions');
        }

        if (['tif', 'jpg', 'png', 'pdf'].indexOf(_this.convertFormat) === -1) {
            errors.push('Invalid format type');
        }

        return errors;
    };
};

ScanRequest.default = {
    top: 0,
    left: 0,
    width: Config.MaximumScanWidthInMm,
    height: Config.MaximumScanHeightInMm,
    mode: "Color",
    resolution: 200,
    format: "tiff",
    outputFilepath: "",
    brightness: 0,
    contrast: 0,
    convertFormat: 'tif',
    dynamicLineart: true
};

module.exports = ScanRequest;