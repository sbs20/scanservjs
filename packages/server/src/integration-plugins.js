const Config = require('./config');

class IntegrationPlugin {
  static list() {
    return Config.plugins || {};
  }
}
module.exports = IntegrationPlugin;
