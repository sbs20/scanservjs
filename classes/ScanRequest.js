var Config = require('./Config');
var System = require('./System');

var ScanRequest = function (def) {

	var Mode = {
		Lineart: 'Lineart',
		Gray: 'Gray',
		Color: 'Color'
	};

	_this = this;

	System.extend(_this, ScanRequest.default, def);

	_this.validate = function () {
		var errors = [];

		if (Mode[_this.mode] === undefined) {
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

		if (_this.top + _this.height > Config.MaximumScanHeightInMm) {
			errors.push('Top + height exceed maximum dimensions');
		}

		return errors;
	};
};

ScanRequest.default = {
	top: 0,
	left: 0,
	width: 215,
	height: 297,
	mode: "Color",
	depth: 8,
	resolution: 200,
	format: "tiff",
	outputFilepath: "",
	brightness: 0,
	contrast: 0
};

module.exports = ScanRequest;