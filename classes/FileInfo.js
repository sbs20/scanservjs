var fs = require('fs');
var path = require('path');

module.exports = function (fullpath) {
	var stat = fs.statSync(fullpath);
	this.fullname = fullpath;
	this.name = path.basename(this.fullname);
	this.path = path.dirname(this.fullname);
	this.extension = path.extname(this.fullname);
	this.lastModified = stat.mtime;
	this.size = stat.size;

	this.delete = function () {
		return fs.unlink(this.fullname);
	};
};
