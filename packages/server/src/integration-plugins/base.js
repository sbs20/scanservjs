const Config = require('../config');

// Base class for Integration Plugin functionality
class BasePlugin {

  constructor(pluginconfig, pluginsecret) {
    this.pluginconfig = pluginconfig;
    this.pluginsecret = pluginsecret;
  }


  /**
   * @param {FileInfo} fileInfo
   */
  onScan(fileInfo) {}

  static runOnScan(fileInfo) {
    this.getRegisteredPlugins().forEach((pluginObj) => {
      pluginObj.onScan(fileInfo);
    });

  }

  static getPlugin(name) {
    const PaperlessPlugin = require('./paperless');
    if (name === 'paperless') {
      return PaperlessPlugin;
    }
    throw new Error(`Unrecognized plugin ${name}`);
  }

  /**
   * Gets all the plugin objects instantiated
   */
  static getRegisteredPlugins() {
    let plugins = [];
    for (const plugin in Config.plugins) {
      const Plugin = BasePlugin.getPlugin(plugin);
      const pluginconfig = Config.plugins[plugin];
      const pluginsecret = Config.plugin_secrets[plugin];
      plugins.append(Plugin(pluginconfig, pluginsecret));
    }
    return plugins;
  }
}

module.exports = BasePlugin;
