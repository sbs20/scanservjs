var Q = require('kew');
var Config = require('./Config');
var System = require('./System');
var FileInfo = require('./FileInfo');

module.exports = function () {

	var _this = this;

	var exists = function () {
		var fileInfo = new FileInfo(Config.Scanimage);
		return fileInfo.exists();
	};

	var commandLine = function (scanRequest) {
		var cmd = Config.Scanimage;
		cmd += ' --mode ' + scanRequest.mode;
		
		if (Config.SupportsDepth) {
		  cmd += ' --depth ' + scanRequest.depth;
		}
		cmd += ' --resolution ' + scanRequest.resolution;
		cmd += ' -l ' + scanRequest.left;
		cmd += ' -t ' + scanRequest.top;
		cmd += ' -x ' + scanRequest.width;
		cmd += ' -y ' + scanRequest.height;
		cmd += ' --format ' + scanRequest.format;
		cmd += ' --brightness ' + scanRequest.brightness;
		cmd += ' --contrast ' + scanRequest.contrast;

		// Last
		cmd += ' > "' + scanRequest.outputFilepath + '"';
		return cmd;
	};

	_this.execute = function (scanRequest) {

		if (!exists()) {
			return Q.reject(new Error('Unable to find Scanimage at "' + Config.Scanimage + '"'));
		}

		var response = {
			image: null,
			cmdline: null,
			output: [],
			errors: [],
			returnCode: -1
		};

		System.trace('Scanimage.execute:start');

		response.errors = scanRequest.validate();

		if (response.errors.length === 0) {

			response.cmdline = commandLine(scanRequest);

			return System.execute(response.cmdline)
				.then(function (reply) {
					System.trace('Scanimage.execute:finish', reply);
					response.output = reply.output;
					response.code = reply.code;
					response.image = scanRequest.outputFilepath;
					return response;
				});

		} else {
			return Q.reject(response);
		}
	};
};
