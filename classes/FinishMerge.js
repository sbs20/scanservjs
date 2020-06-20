var Q = require('kew');
var Config = require('./Config');
var System = require('./System');

module.exports = function (arg) {
    var _this = this;

    _this.args = System.extend({
        pages: undefined,
        target: undefined,
        normalize:  false,
        trim: false,
        sharpen: 0,
        quality: undefined,
        ignoreStdError: false,
        ocr: false
    }, arg);

    _this.cmd = function () {
        var params = ' ';
        if (_this.args.ignoreStdError) params += Config.IgnoreStdError + ' ';
        if (_this.args.normalize) params += '-normalize ';
        if (_this.args.trim) params += '-trim ';
        if (_this.args.sharpen) params += '-sharpen ' + _this.args.sharpen + ' ';
        if (_this.args.quality) params += '-quality ' + _this.args.quality + ' ';

        return Config.Convert + ' '  +
            params +
            '"' + _this.args.pages.join('" "') + '" "' +
            _this.args.target + '.pdf"';
    };

    _this.executeTesseract = function () {
        var params = ' ';
        params += '-l ' + Config.TesseractLanguage + ' ';
        params += '--psm 3 ';

        var cmd = Config.Tesseract + ' ' +
            params +
            'stdin "' +
            _this.args.target + '" pdf';

        var pages = _this.args.pages.join('\n');

        return System.executeWrite(cmd, pages);
    };

    // Returns a promise
    _this.execute = function () {
        if (_this.args.pages.length === 0) {
            return Q.reject(new Error('no pages supplied'));
        }
        var promise = _this.args.ocr ? _this.executeTesseract() : System.execute(_this.cmd());
        return promise
            .fail(function (error) {
                // Incomplete scan images are corrupt and will throw an error like
                // convert: Read error on strip 23; got 3343 bytes, expected 8037. `TIFFFillStrip'
                // We can just ignore that and resolve as there will be an output file
                if (error.message.indexOf('TIFFFillStrip') !== -1) {
                    return Q.resolve();
                }

                // If it's something else then reject
                return Q.reject(error);
            });
    };
};
