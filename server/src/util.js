const AdmZip = require('adm-zip');

const Util = {
  extend() {
    const t = arguments[0];
    for (let i = 1; i < arguments.length; i++) {
      const s = arguments[i];
      for (const p in s) {
        t[p] = s[p];
      }
    }
    return t;
  },

  /**
   * @param {string[]} filepaths
   * @param {string} destination
   * @returns {void}
   */
  zip(filepaths, destination) {
    const zip = new AdmZip();
    for (let filepath of filepaths) {
      zip.addLocalFile(filepath);
    }
    zip.writeZip(destination);
  }
};

module.exports = Util;