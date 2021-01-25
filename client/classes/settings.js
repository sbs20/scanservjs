import Common from './common';

export default class Settings {
  constructor(obj) {
    obj = obj || Settings.default();
    Object.apply(this, obj);
  }

  static default() {
    return {
      version: Common.version(),
      theme: 'system'
    };
  }
}