/**
 * @param {number} n 
 * @returns {number}
 */
function round(n) {
  return Math.floor(n * 10) / 10;
}

class Feature {
  /**
   * Constructor
   */
  constructor() {
  }

  get enabled() {
    return !['inactive', 'read-only'].includes(this.default);
  }

  /**
   * @param {string} string 
   * @param {string} delimiter
   * @returns {number[]} 
   */
  static splitNumbers(string, delimiter) {
    return string.replace(/[a-z%]/ig, '')
      .split(delimiter)
      .filter(s => s.length > 0)
      .map(s => Number(s));
  }

  range() {
    this.default = round(Number(this.default));
    const range = /(.*?)(?:\s|$)/g.exec(this.parameters);
    this.limits = Feature.splitNumbers(range[1], '..');
    const steps = /\(in steps of (\d+\.?\d*)\)/g.exec(this.parameters);
    this.interval = steps ? Number(steps[1]) : 1;
  }

  resolution() {
    if (this.parameters.indexOf('|') > -1) {
      this.options = Feature.splitNumbers(this.parameters, '|');
      this.default = Number(this.default);

    } else if (this.parameters.indexOf('..') > -1) {
      this.range(this);
      const limits = this.limits;
      this.options = [];
      for (let value = limits[1]; value > limits[0]; value /= 2) {
        this.options.push(value);
      }
      this.options.push(limits[0]);
      this.options.sort((a, b) => a - b);
    }
  }

  geometry() {
    this.range();
    this.limits[0] = round(this.limits[0]);
    this.limits[1] = round(this.limits[1]);
  }

  lighting() {
    this.range();
  }

  load() {
    this.parameters = this.parameters.replace(/^auto\|/, '');
    if (this.enabled) {
      switch (this.name) {
        case '--mode':
        case '--source':
          this.options = this.parameters.split('|');
          break;

        case '--resolution':
          this.resolution();
          break;

        case '-l':
        case '-t':
        case '-x':
        case '-y':
          this.geometry();
          break;
        
        case '--brightness':
        case '--contrast':
          this.lighting();
          break;
      }
    }
  }

  static parse(s) {
    const match = /^\s*([-]{1,2}[-a-zA-Z0-9]+) ?(.*) \[(.*)\]$/g.exec(s);
    const feature = new Feature();
    feature.text = s;
    feature.name = match[1];
    feature.default = match[3];
    feature.parameters = match[2];
    feature.load();
    return feature;
  }
}

module.exports = Feature;
