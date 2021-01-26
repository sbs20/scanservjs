const fs = require('fs');
const mv = require('mv');
const path = require('path');

const checkPath = (fullpath) => {
  if (fullpath.indexOf('../') !== -1) {
    throw new Error('Parent paths disallowed');
  }

  if (fullpath.indexOf('/') === 0) {
    throw new Error('Root paths disallowed');
  }
};

const sizeString = (size) => {
  const kb = 1 << 10;
  const mb = kb << 10;
  if (size < 0) {
    return '0';
  } else if (size === 1) {
    return '1 Byte';
  } else if (size < kb << 1) {
    return `${size} Bytes`;
  } else if (size < mb << 1) {
    return `${Math.round(size / kb)} KB`;
  } else {
    return `${Math.round(100.0 * size / mb) / 100.0} MB`;
  }
};

class FileInfo {
  /**
   * @param {string} fullpath 
   */
  constructor(fullpath) {
    checkPath(fullpath);
    this.fullname = fullpath;
    this.name = path.basename(this.fullname);
    this.path = path.dirname(this.fullname);
    if (this.exists()) {
      const stat = fs.statSync(this.fullname);
      this.extension = path.extname(this.fullname);
      this.lastModified = stat.mtime;
      this.size = stat.size;
      this.sizeString = sizeString(this.size);
      this.isDirectory = stat.isDirectory();
    }
  }

  /**
   * @param {string} fullpath 
   */
  static create(fullpath) {
    return new FileInfo(fullpath);
  }

  /**
   * @returns {FileInfo}
   */
  delete() {
    try {
      fs.unlinkSync(this.fullname);
      this.deleted = true;
    } catch (e) {
      this.deleted = false;
    }

    return this;
  }

  /**
   * @param {FileInfo} fileinfo 
   * @returns {boolean}
   */
  equals(fileinfo) {
    return path.resolve(this.fullname) === path.resolve(fileinfo.fullname);
  }

  /**
   * @returns {boolean}
   */
  exists() {
    return fs.existsSync(this.fullname);
  }

  /**
   * @returns {Promise.<void>}
   */
  async move(destination) {
    return await new Promise((resolve, reject) => {
      mv(this.fullname, destination, (err) => {
        if (err) {
          reject(err);
        }
        resolve();
      });
    });
  }

  /**
   * @param {BufferLike}
   * @returns {void}
   */
  save(data) {
    fs.writeFileSync(this.fullname, data);
  }

  /**
   * @returns {string}
   */
  toBase64() {
    return this.toBuffer().toString('base64');
  }

  /**
   * @returns {Buffer}
   */
  toBuffer() {
    const bits = fs.readFileSync(this.fullname);
    return Buffer.from(bits);
  }

  /**
   * @returns {string}
   */
  toText() {
    return this.toBuffer().toString();
  }

  /**
   * @returns {any}
   */
  toJson() {
    return JSON.parse(this.toText());
  }

  /**
   * @returns {Promise.<FileInfo[]>}
   */
  async list() {
    return await new Promise((resolve, reject) => {
      if (!this.isDirectory) {
        reject(`${this.fullname} is not a directory`);
      }
      fs.readdir(this.fullname, (err, list) => {
        if (err) {
          reject(err);
        }

        const files = list.map(f => new FileInfo(`${this.fullname}/${f}`));
        resolve(files);
      });
    });
  }
}

module.exports = FileInfo;