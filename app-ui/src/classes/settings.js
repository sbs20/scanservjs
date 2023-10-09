import Constants from './constants';

export default class Settings {
  static create(obj) {
    obj = Object.assign(Settings.default(), obj);
    return obj;
  }

  static default() {
    return {
      version: Constants.Version,
      theme: 'system',
      appColor: 'accent-4',
      showFilesAfterScan: true,
      thumbnails: {
        show: true,
        size: 64
      }
    };
  }
}
