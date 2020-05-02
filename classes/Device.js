var Q = require('kew');
var Config = require('./Config');
var System = require('./System');
var FileInfo = require('./FileInfo');

module.exports = function () {
    var _this = this;
    _this.data = null;

    _this.load = function (data) {
        _this.data = data;
    };

    /// Parses the response of scanimage -A into a dictionary
    var parse = function (response) {
        // find any number of spaces
        // ... match 1 or two hyphens with letters, numbers or hypen
        // find anything
        // ... match anything inside square brackets
        if (response === null || response === '') {
            throw new Error('No device found');
        }
        
        var device = {
            'name': '',
            'version': System.version,
            'features': {}
        };
        
        var pattern = /\s+([-]{1,2}[-a-zA-Z0-9]+) ?(.*) \[(.*)\]\n/g;
        var match;
        while ((match = pattern.exec(response)) !== null) {
            device.features[match[1]] = {
                'default': match[3],
                'options': match[2]
            };
        }

        pattern = /All options specific to device `(.*)'/;
        match = pattern.exec(response);
        if (match) {
            device.name = match[1];
        }

        return device;
    };

    /// Executes scanimageA and returns a promise of parsed results
    var scanimageA = function () {
        var cmd = Config.Scanimage;
        if(Config.DeviceName){
            cmd += ' -d "'+Config.DeviceName+'"';
        }
        cmd += ' -A';

        return System.execute(cmd)
            .then(function (reply) {
                try {
                    var data = parse(reply.output);
                    System.trace('device', data);
                    return data;
                } catch (exception) {
                    return Q.reject(exception);
                }
            });
    };

    /// Attempts to get a stored configuration of our device and if
    /// not gets it from the command line.
    _this.get = function () {
        var conf = new FileInfo('./device.conf');
        var isLoadRequired = false;
        if (!conf.exists()) {
            System.trace('device.conf does not exist. Reloading');
            isLoadRequired = true;
        } else if (JSON.parse(conf.toText()).version !== System.version) {
            System.trace('device.conf version is old. Reloading');
            isLoadRequired = true;
        }

        if (isLoadRequired) {
            return scanimageA().then(function (data) {
                // Humans might read this, so pretty
                conf.save(JSON.stringify(data, null, 4));
                return data;
            });
        } else {
            return Q.resolve(JSON.parse(conf.toText()));            
        }
    };

    _this.isFeatureSupported = function (feature) {
        if (_this.data && _this.data.features && feature in _this.data.features) {
            return _this.data.features[feature].default !== 'inactive';
        }

        return false;
    };

    _this.modes = function() {
        return _this.data.features['--mode'].options.split('|');
    };
};