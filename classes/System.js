var config = require("./Config");
var exec = require('child_process').exec;
var Q = require('kew');

var System = {

	log: function (k, v) {
		if (Array.isArray(v)) {
			v.forEach(function (e) {
				System.trace(k, e);
			});
		} else {
			if (v === null) {
				v = "{NULL}";
			}

			console.log(k + '=' + v + config.TraceLineEnding);
		}
	},

	trace: function (k, v) {
		if (config.IsTrace) {
			System.log(k, v);
		}
	},

	execute(cmd) {
		var deferred = Q.defer();

		var reply = {
			cmd: cmd,
			output: '',
			code: -1
		};

		if (!config.BypassSystemExecute) {
			System.trace('System.execute:start', cmd);

			exec(cmd, function (error, stdout, stderr) {
				System.extend(reply, {
					output: stdout,
					code: 0
				});

				System.trace('System.execute:finish', reply);

				deferred.resolve(reply);
			});
		}

		return deferred.promise;
	},

	error: function (e) {
		System.log("Error", $e);
	},

	scannerDevices: function () {
		var cmd = config.Scanimage + " -L";
		return System.execute(cmd);
	},

	extend: function () {
		var t = arguments[0];
		for (var i = 1; i < arguments.length; i++) {
			var s = arguments[i];
			for (var p in s) {
				t[p] = s[p];
			}
		}
		return t;
	}
};

module.exports = System;