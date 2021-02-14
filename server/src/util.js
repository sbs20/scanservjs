const AdmZip = require('adm-zip');
const FileInfo = require('./file-info');

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
  },

  /**
   * 
   * @param {FileInfo[]} files
   * @returns {FileInfo[]} 
   */
  collateReverse(files) {
    const odd = files.filter(f => f.name.match(/\d{4}-1\.tif/));
    const even = files.filter(f => f.name.match(/\d{4}-2\.tif/))
      .sort((f1, f2) => -f1.name.localeCompare(f2.name));

    files = [];
    for (let index = 0; index < odd.length; index++) {
      files.push(odd[index]);
      if (even[index]) {
        files.push(even[index]);
      }
    }
    return files;
  }
};

module.exports = Util;