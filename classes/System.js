var packageJson = require("../package.json");
var config = require("./Config");
var exec = require('child_process').exec;
var Q = require('kew');

var System = {

    version: packageJson.version,

    isArray: function (obj) {
        return Array.isArray(obj);
    },

    isObject: function (obj) {
        return obj === Object(obj);
    },

    log: function (k, v) {
        if (System.isArray(v)) {
            v.forEach(function (e) {
                System.trace(k, e);
            });

        } else if (System.isObject(v)) {
            System.trace(k, JSON.stringify(v));

        } else if (v === undefined) {
            console.log(k + config.TraceLineEnding);

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

    execute: function (cmd) {
        var deferred = Q.defer();

        var res = {
            cmd: cmd,
            output: '',
            code: -1
        };

        if (!config.BypassSystemExecute) {
            System.trace('System.execute:start', cmd);

            exec(cmd, function (error, stdout) {
                if (error) {
                    deferred.reject(error);
                    return;
                }

                System.extend(res, {
                    output: stdout,
                    code: error ? -1 : 0
                });

                System.trace('System.execute:finish', res);

                deferred.resolve(res);
            });
        }

        return deferred.promise;
    },

    executeWrite: function (cmd, stdin) {
        var deferred = Q.defer();

        var res = {
            cmd: cmd,
            output: '',
            code: -1
        };

        if (!config.BypassSystemExecute) {
            System.trace('System.executeWrite:start', cmd);

            var child = exec(cmd, function (error, stdout) {
                if (error) {
                    deferred.reject(error);
                    return;
                }

                System.extend(res, {
                    output: stdout,
                    code: error ? -1 : 0
                });

                System.trace('System.executeWrite:finish', res);

                deferred.resolve(res);
            });
            child.stdin.setEncoding = 'utf-8';
            child.stdin.write(stdin);
            child.stdin.end();
        }

        return deferred.promise;
    },

    error: function (e) {
        System.log("Error", e);
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