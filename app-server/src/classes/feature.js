/**
 * @param {number} n
 * @returns {number}
 */
function round(n) {
  return Math.floor(n * 10) / 10;
}

/**
 * @param {string} string
 * @param {string} delimiter
 * @returns {number[]}
 */
function splitNumbers(string, delimiter) {
  return string.replace(/[a-z%]/ig, '')
    .split(delimiter)
    .filter(s => s.length > 0)
    .map(s => Number(s));
}

module.exports = class Feature {
  /**
   * Constructor
   * @param {string} text
   */
  constructor(text) {
    this.text = text;
    this.load();
  }

  asRange() {
    this.default = round(Number(this.default));
    const range = /(.*?)(?:\s|$)/g.exec(this.parameters);
    this.limits = splitNumbers(range[1], '..');
    const steps = /\(in steps of (\d+\.?\d*)\)/g.exec(this.parameters);
    this.interval = steps ? Number(steps[1]) : 1;
  }

  asEnum() {
    // Example: [=(yes|no)]
    const match = /^\[=\((.*)\)\]$/.exec(this.parameters);
    if (match !== null) {
      this.options = match[1].split('|');
    }
  }

  asResolution() {
    if (this.parameters.indexOf('|') > -1) {
      this.options = splitNumbers(this.parameters, '|');
      this.default = Number(this.default);

    } else if (this.parameters.indexOf('..') > -1) {
      this.asRange(this);
      const limits = this.limits;
      this.options = [];
      for (let value = limits[1]; value > limits[0]; value /= 2) {
        this.options.push(value);
      }
      this.options.push(limits[0]);
      this.options.sort((a, b) => a - b);
    }
  }

  asGeometry() {
    this.asRange();
    this.limits[0] = round(this.limits[0]);
    this.limits[1] = round(this.limits[1]);
  }

  asLighting() {
    this.asRange();
  }

  load() {
    const match = /^\s*([-]{1,2}[-a-zA-Z0-9]+) ?(.*?) \[(.*?)\](?: \[(.*?)\])?$/g.exec(this.text);
    this.name = match[1];
    this.default = match[3];
    this.parameters = match[2];
    this.meta = match[4];
    this.enabled = this.default !== 'inactive' && this.meta !== 'read-only';

    this.parameters = this.parameters.replace(/^auto\|/, '');
    if (this.enabled) {
      switch (this.name) {
        case '--adf-mode':
        case '--mode':
        case '--source':
          this.options = this.parameters.split('|');
          break;

        case '--resolution':
          this.asResolution();
          break;

        case '-l':
        case '-t':
        case '-x':
        case '-y':
        case '--page-height':
        case '--page-width':
          this.asGeometry();
          break;

        case '--brightness':
        case '--contrast':
          this.asLighting();
          break;

        case '--ald':
          this.asEnum();
          break;
      }
    }
  }

  /**
   * @param {string} s
   * @returns {Feature}
   */
  static parse(s) {
    return new Feature(s);
  }
};
