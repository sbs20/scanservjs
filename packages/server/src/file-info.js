const Config = require('./config');
const fs = require('fs');
const mv = require('mv');
const path = require('path');



/**
 * @param {number} size
 * @returns {string}
 */
function sizeString(size) {
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
}

class FileInfo {
  /**
   * @param {string} fullpath 
   */
  constructor(fullpath, filename) {
    FileInfo.assertPath(fullpath);
    if (filename) {
      FileInfo.assertName(filename);
      fullpath = path.join(fullpath, filename);
    }

    this.fullname = path.normalize(fullpath);
    if (this.exists()) {
      const stat = fs.statSync(this.fullname);
      this.extension = path.extname(this.fullname);
      this.lastModified = stat.mtime;
      this.size = stat.size;
      this.sizeString = sizeString(this.size);
      this.isDirectory = stat.isDirectory();
      if (this.isDirectory && this.fullname.endsWith('/')) {
        this.fullname = this.fullname.substr(0, this.fullname.length - 1);
      }
    }
    this.name = path.basename(this.fullname);
    this.path = path.dirname(this.fullname);
  }

  /**
   * @param {string} name 
   */
  static assertName(name) {
    if (name === null || name === undefined) {
      throw new Error('Name cannot be null or undefined');
    }

    if (/[/\\?%*:|"<>;=]/.test(name)) {
      throw new Error('Name cannot contain illegal characters: /\\?%*:|"<>;=');
    }
  }

  /**
   * @param {string} fullpath 
   */
  static assertPath(fullpath) {
    if (/[?%*:|"<>;=]/.test(fullpath)) {
      throw new Error('Path cannot contain illegal characters: ?%*:|"<>;=');
    }

    if (!Config.allowUnsafePaths) {
      if (fullpath.indexOf('../') !== -1) {
        throw new Error('Parent paths disallowed');
      }
    
      if (fullpath.indexOf('/') === 0) {
        throw new Error('Root paths disallowed');
      }  
    }
  }
  
  /**
   * @param {string} fullpath 
   */
  static create(fullpath) {
    return new FileInfo(fullpath);
  }

  /**
   * @param {string} fullpath 
   * @param {string} filename 
   */
  static unsafe(fullpath, filename) {
    return new FileInfo(fullpath, filename);
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
    FileInfo.assertPath(destination);
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

        const files = list.map(f => FileInfo.create(`${this.fullname}/${f}`));
        resolve(files);
      });
    });
  }
}

module.exports = FileInfo;