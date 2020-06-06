var Q = require('kew');
var Config = require('./Config');
var Device = require('./Device');
var System = require('./System');
var FileInfo = require('./FileInfo');

module.exports = function () {

    var _this = this;

    var exists = function () {
        var fileInfo = new FileInfo(Config.Scanimage);
        return fileInfo.exists();
    };

    var commandLine = function (scanRequest, device) {
        var cmd = Config.Scanimage;
        if (device.data.name) {
            cmd += ' -d "' + device.data.name + '"';
        }
        cmd += ' --mode "' + scanRequest.mode + '"';
        
        if (device.isFeatureSupported('--depth') && 'depth' in scanRequest) {
            cmd += ' --depth ' + scanRequest.depth;
        }

        cmd += ' --resolution ' + scanRequest.resolution;
        cmd += ' -l ' + scanRequest.left;
        cmd += ' -t ' + scanRequest.top;
        cmd += ' -x ' + scanRequest.width;
        cmd += ' -y ' + scanRequest.height;
        cmd += ' --format ' + scanRequest.format;

        if (device.isFeatureSupported('--brightness')) {
            cmd += ' --brightness ' + scanRequest.brightness;
        }

        if (device.isFeatureSupported('--contrast')) {
            cmd += ' --contrast ' + scanRequest.contrast;
        }

        if (scanRequest.mode === 'Lineart' && !scanRequest.dynamicLineart &&
                device.isFeatureSupported('--disable-dynamic-lineart')) {
            cmd += ' --disable-dynamic-lineart=yes ';
        }

        if (scanRequest.convertFormat !== 'tif' && !scanRequest.multiplePages) {
            cmd += ' | convert - ' + scanRequest.convertFormat + ':-';
        }

        // Last
        cmd += ' > "' + scanRequest.outputFilepath + '"';
        return cmd;
    };

    _this.execute = function (scanRequest) {
        if (!exists()) {
            return Q.reject(new Error('Unable to find Scanimage at "' + Config.Scanimage + '"'));
        }

        var device = new Device();

        if ('device' in scanRequest && scanRequest.device) {
            device.load(scanRequest.device);
        }

        var response = {
            image: null,
            cmdline: null,
            output: [],
            errors: [],
            returnCode: -1
        };

        System.trace('Scanimage.execute:start');
        response.errors = scanRequest.validate(device);

        if (response.errors.length === 0) {
            response.cmdline = commandLine(scanRequest, device);

            return System.execute(response.cmdline)
                .then(function (reply) {
                    System.trace('Scanimage.execute:finish', reply);
                    response.output = reply.output;
                    response.code = reply.code;
                    response.image = scanRequest.outputFilepath;
                    return response;
                });

        } else {
            var error = new Error(response.errors.join('\n'));
            return Q.reject(error);
        }
    };
};
