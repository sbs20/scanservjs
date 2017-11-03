var fs = require('fs');
var path = require('path');

module.exports = function (fullpath) {

	this.fullname = fullpath;

	this.init = function () {
		this.name = path.basename(this.fullname);
		this.path = path.dirname(this.fullname);

		if (this.exists()) {
			var stat = fs.statSync(this.fullname);
			this.extension = path.extname(this.fullname);
			this.lastModified = stat.mtime;
			this.size = stat.size;
		}
	};

	this.delete = function () {
		try {
			fs.unlinkSync(this.fullname);
			this.deleted = true;
		}
		catch (e) {
			this.deleted = false;
		}

		return this;
	};

	this.exists = function () {
		return fs.existsSync(this.fullname);
	};

	this.toBuffer = function () {
		var bits = fs.readFileSync(this.fullname);
		return new Buffer(bits);
	};

	this.toBase64 = function () {
		return this.toBuffer().toString('base64');
	};

	this.toText = function () {
		return this.toBuffer().toString();
	};

	this.init();
};
