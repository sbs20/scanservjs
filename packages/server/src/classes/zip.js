const AdmZip = require('adm-zip');

module.exports = class Zip {
  /**
   * Constructor
   * @param {string} filename
   */
  constructor(filename) {
    this.filename = filename;
  }

  /**
   * @param {string[]} sources
   * @returns {void}
   */
  deflate(sources) {
    const zip = new AdmZip();
    for (let filepath of sources) {
      zip.addLocalFile(filepath);
    }
    zip.writeZip(this.filename);
  }

  /**
   * @returns {string[]}
   */
  list() {
    const zip = new AdmZip(this.filename);
    return zip.getEntries().map(e => e.entryName);
  }

  /**
   * @param {string} filename
   * @returns {Zip}
   */
  static file(filename) {
    return new Zip(filename);
  }
};
