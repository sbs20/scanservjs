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

/**
 * @param {string} path
 * @returns {void}
 */
function assertPathIsSafe(path) {
  if (path.indexOf('../') !== -1) {
    throw new Error('Parent paths disallowed');
  }

  if (path.indexOf('/') === 0) {
    throw new Error('Root paths disallowed');
  }
}

/**
 * @param {string} filename
 * @returns {void}
 */
function assertFilenameIsSafe(filename) {
  if (/[/\\?%*:|"<>;=]/.test(filename)) {
    throw new Error('Name cannot contain illegal characters: /\\?%*:|"<>;=');
  }
}

module.exports = class FileInfo {
  /**
   * @param {string} fullpath
   * @param {string} [filename]
   */
  constructor(fullpath, filename) {
    if (/[?%*:|"<>;=]/.test(fullpath)) {
      throw new Error('Path cannot contain illegal characters: ?%*:|"<>;=');
    }

    const disallowUnsafePaths = false;
    if (disallowUnsafePaths) {
      assertPathIsSafe(fullpath);
    }

    if (filename) {
      assertFilenameIsSafe(filename);
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
   * Used to create FileInfo objects when the path is known and controlled by
   * the app
   * @param {string} fullpath
   * @returns {FileInfo}
   */
  static create(fullpath) {
    return new FileInfo(fullpath);
  }

  /**
   * Used to create FileIbfo objects when the filename is from an external and
   * therefore untrusted source
   * @param {string} fullpath
   * @param {string} filename
   * @returns {FileInfo}
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
   * @param {string} filename
   * @returns {Promise.<FileInfo>}
   */
  async rename(filename) {
    assertFilenameIsSafe(filename);
    const destinationFilepath = `${this.path}/${filename}`;
    if (FileInfo.unsafe(destinationFilepath).exists()) {
      throw new Error(`${destinationFilepath} already exists`);
    }
    return this.move(destinationFilepath);
  }

  /**
   * @param {string} destination
   * @returns {Promise.<FileInfo>}
   */
  async move(destination) {
    return await new Promise((resolve, reject) => {
      mv(this.fullname, destination, (err) => {
        if (err) {
          reject(err);
        }
        resolve(FileInfo.create(destination));
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
  parseJson() {
    return JSON.parse(this.toText());
  }

  /**
   * @returns {Promise.<FileInfo[]>}
   */
  async list() {
    return await new Promise((resolve, reject) => {
      if (!this.exists()) {
        reject(new Error(`${this.fullname} does not exist`));

      } else if (!this.isDirectory) {
        reject(new Error(`${this.fullname} is not a directory`));

      } else {
        fs.readdir(this.fullname, (err, list) => {
          if (err) {
            reject(err);
          }

          const files = list.map(f => FileInfo.create(`${this.fullname}/${f}`));
          resolve(files);
        });
      }
    });
  }
};
