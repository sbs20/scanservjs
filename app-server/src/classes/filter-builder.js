module.exports = class FilterBuilder {

  /**
   * @param {Configuration} config
   */
  constructor(config) {
    this.config = config;
  }

  /**
   * @param {string[]} selected
   * @param {boolean} [ignoreRotations]
   * @returns {string}
   */
  build(selected, ignoreRotations) {
    ignoreRotations = ignoreRotations === undefined ? false : ignoreRotations;
    const filters = this.config.filters
      .filter(f => !ignoreRotations || !f.params.includes('-rotate'))
      .filter(f => selected.includes(f.description));

    const params = filters.map(f => f.params).join(' ');
    return params;
  }
};
