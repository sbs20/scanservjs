module.exports = class Regex {
  /**
   * Constructor
   * @param {RegExp} regexp
   */
  constructor(regexp) {
    this.regexp = regexp;
  }

  /**
   * Rough polyfill for str.matchAll()
   * @param {string} string
   * @returns {RegExpExecArray[]}
   */
  matchAll(string) {
    /** @type {RegExpExecArray[]} */
    const result = [];
    /** @type {RegExpExecArray} */
    let match;
    while ((match = this.regexp.exec(string)) !== null) {
      result.push(match);
    }
    return result;
  }

  /**
   * Creates a Regex
   * @param {RegExp} regexp
   * @returns {Regex}
   */
  static with(regexp) {
    return new Regex(regexp);
  }
};
