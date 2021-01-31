import Constants from './constants';
import Settings from './settings';

let storage = null;

export default class Storage {

  get request() {
    let request = null;
    if (localStorage.request) {
      request = JSON.parse(localStorage.request);
      if (request.version !== Constants.Version) {
        request = null;
      }
      console.log('load', request);
    }
    return request;
  }

  set request(request) {
    if (request) {
      localStorage.request = JSON.stringify(request);
    } else {
      localStorage.removeItem('request');
    }
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
   * @returns {Storage}
   */
  static instance() {
    if (storage === null) {
      storage = new Storage();
    }
    return storage;
  }
}