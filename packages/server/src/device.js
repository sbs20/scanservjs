const Feature = require('./feature');
const Util = require('./util');

/** @type {ScanDevice} */
class Device {
  constructor(string) {
    this.id = '';
    this.features = {};
    this.string = string;
    this.parse();
  }

  /**
   * Parses the response of scanimage -A into a ScanDevice
   */
  parse() {
    if (this.string === null || this.string === '') {
      throw new Error('No device found');
    }
    
    // find
    //   any number of spaces
    //   match 1 or two hyphens with letters, numbers or hypen
    //   match anything (until square brackets)
    //   match anything inside square brackets
    Util.matchAll(/\s+([-]{1,2}[-a-zA-Z0-9]+ ?.* \[.*\])\n/g, this.string)
      .map(m => m[1])
      .map(Feature.parse)
      .filter(f => f.enabled)
      .forEach(f => this.features[f.name] = f);
  
    const match = /All options specific to device `(.*)'/.exec(this.string);
    if (match) {
      this.id = match[1];
    } else {
      throw new Error('Scanimage output contains no matching expressions');
    }

    this.validate();
  }

  validate() {
    const mandatory = ['--resolution'];
    for (const feature of mandatory) {
      if (this.features[feature] === undefined) {
        throw `${feature} is missing from device`;
      }
    }
  }

  /**
   * @param {string} s
   * @returns {ScanDevice}
   */
  static from(s) {
    if (typeof s === 'string') {
      return new Device(s);
    } else {
      throw new Error('Unexpected data for Device');
    }
  }
}

module.exports = Device;