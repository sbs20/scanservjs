const fs = require('fs');
const path = require('path');

class FileInfo {
  constructor(fullpath) {
    if (fullpath.indexOf('../') !== -1) {
      throw new Error('Relative paths disallowed');
    }
    this.fullname = fullpath;
    this.name = path.basename(this.fullname);
    this.path = path.dirname(this.fullname);
    if (this.exists()) {
      const stat = fs.statSync(this.fullname);
      this.extension = path.extname(this.fullname);
      this.lastModified = stat.mtime;
      this.size = stat.size;
    }
  }

  delete() {
    try {
      fs.unlinkSync(this.fullname);
      this.deleted = true;
    } catch (e) {
      this.deleted = false;
    }

    return this;
  }

  exists() {
    return fs.existsSync(this.fullname);
  }

  save(data) {
    fs.writeFileSync(this.fullname, data);
  }

  toBase64() {
    return this.toBuffer().toString('base64');
  }

  toBuffer() {
    const bits = fs.readFileSync(this.fullname);
    return Buffer.from(bits);
  }

  toText() {
    return this.toBuffer().toString();
  }

  toJson() {
    return JSON.parse(this.toText());
  }
}

module.exports = FileInfo;