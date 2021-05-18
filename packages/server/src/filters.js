const Config = require('./config');

class Filters {
  /**
   * @param {string[]} selected 
   * @param {boolean} [ignoreRotations] 
   * @returns {string}
   */
  static build(selected, ignoreRotations) {
    ignoreRotations = ignoreRotations === undefined ? false : ignoreRotations;
    const filters = Config.filters
      .filter(f => !ignoreRotations || !f.params.includes('-rotate'))
      .filter(f => selected.includes(f.description));

    const params = filters.map(f => f.params).join(' ');
    return params;
  }

}

module.exports = Filters;
