var fs = require('fs');
var Q = require('kew');

var Config = require('./Config');
var System = require('./System');

module.exports = function (arg) {
    var _this = this;

    _this.args = System.extend({
        source: undefined,
        target: undefined,
        normalize:  false,
        trim: false,
        sharpen: 0,
        quality: undefined
    }, arg);

    _this.cmd = function () {
        var params = ' ';
        if (_this.args.normalize) params += '-normalize ';
        if (_this.args.trim) params += '-trim ';
        if (_this.args.sharpen) params += '-sharpen ' + _this.args.sharpen + ' ';
        if (_this.args.quality) params += '-quality ' + _this.args.quality + ' ';

        return Config.Convert + ' '  +
            Config.IgnoreStdError + ' ' +
            params +
            _this.args.source + ' ' +
            _this.args.target;
    };

    // Returns a promise
    _this.execute = function () {
        var cmd = _this.cmd();
        return System.execute(cmd);
    };
}