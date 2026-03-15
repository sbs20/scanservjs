import Settings from './settings';

let storage = null;

export default class Storage {

  get request() {
    return localStorage.request ? JSON.parse(localStorage.request) : null;
  }

  set request(request) {
    if (request) {
      localStorage.request = JSON.stringify(request);
    } else {
      localStorage.removeItem('request');
    }
  }

  get transformations() {
    return localStorage.transformations ? JSON.parse(localStorage.transformations) : null;
  }

  set transformations(transformations) {
    if (transformations) {
      localStorage.transformations = JSON.stringify(transformations);
    } else {
      localStorage.removeItem('transformations');
    }
  }

  get isPreviewScan() {
    return localStorage.isPreviewScan === 'true';
  }

  set isPreviewScan(isPreviewScan) {
    localStorage.isPreviewScan = isPreviewScan ? 'true' : 'false';
  }

  /**
   * @returns {Settings}
   */
  get settings() {
    const data = localStorage.settings ? JSON.parse(localStorage.settings) : null;
    return Settings.create(data);
  }

  /**
   * @param {Settings} [settings]
   */
  set settings(settings) {
    if (settings) {
      localStorage.settings = JSON.stringify(settings);
    } else {
      localStorage.removeItem('settings');
    }
  }

  /**
   * @returns {any}
   */
  get pwaConfig() {
    return localStorage.getItem('pwa-config') ? JSON.parse(localStorage.getItem('pwa-config')) : {};
  }

  /**
   * @param {any} config
   */
  set pwaConfig(config) {
    if (config) {
      localStorage.setItem('pwa-config', JSON.stringify(config));
    } else {
      localStorage.removeItem('pwa-config');
    }
  }

  /**
   * @returns {Storage}
   */
  static instance() {
    if (storage === null) {
      storage = new Storage();
    }
    return storage;
  }
}
