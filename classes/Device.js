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
            'features': {}
        };
        
        var pattern = /\s+([-]{1,2}[-a-zA-Z0-9]+).*\[(.*)\]\n/g;
        var match;
        while ((match = pattern.exec(response)) !== null) {
            device.features[match[1]] = match[2];
        }

        pattern = /All options specific to device `(.*)'/;
        match = pattern.exec(response);
        if (match) {
            device.name = match[1];
        }

        return device;
    };

    _this.find = function () {
        var cmd = Config.Scanimage + ' -A';

        // Uncomment to test
        // return Q.resolve({
        //     name: 'canon',
        //     features: {
        //         '--brightness': '0'
        //     }
        // });

        return System.execute(cmd)
            .then(function (reply) {
                //System.trace('Scanner.buildFeatures:finish', reply);
                try {
                    var data = parse(reply.output);
                    System.trace('device', data);
                    return Q.resolve(data); 
                } catch (exception) {
                    return Q.reject(exception);
                }
            });
    };

    _this.isFeatureSupported = function (feature) {
        if (_this.data && 
            _this.data.features &&
            feature in _this.data.features) {
            return _this.data.features[feature] !== 'inactive';
        }

        return false;
    };
};