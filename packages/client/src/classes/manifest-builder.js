import colors from 'vuetify/lib/util/colors';

export default class ManifestBuilder {
  constructor() {
  }

  static create() {
    return new ManifestBuilder();
  }

  withDark(dark) {
    this.dark = dark;
    return this;
  }

  withStorage(storage) {
    this.storage = storage;
    return this;
  }

  themeColor() {
    const appColor = this.storage.settings.appColor;
    switch (appColor) {
      case 'accent-4':
        return this.dark ? '#272727' : '#F5F5F5';
      case 'deep-purple':
        return colors['deepPurple']['base'];
      case 'light-blue':
        return colors['lightBlue']['base'];
      case 'light-green':
        return colors['lightGreen']['base'];
      case 'deep-orange':
        return colors['deepOrange']['base'];
      default:
        return colors[appColor]['base'];
    }
  }

  build() {
    return {
      theme_color : this.themeColor(),
      background_color : this.dark ? '#000000' : '#FFFFFF',
      display : 'standalone',
      scope : '/',
      start_url : '/#/scan',
      name : 'scanservjs',
      short_name : 'scanservjs',
      description : 'SANE scanner nodejs web ui',
      icons : [
        {
          src : './icons/android-chrome-192x192.png',
          sizes : '192x192',
          type : 'image/png',
          purpose : 'any'
        },
        {
          src : './icons/android-chrome-512x512.png',
          sizes : '512x512',
          type : 'image/png',
          purpose : 'any'
        },
        {
          src : './icons/android-chrome-maskable-192x192.png',
          sizes : '192x192',
          type : 'image/png',
          purpose : 'maskable'
        },
        {
          src : './icons/android-chrome-maskable-512x512.png',
          sizes : '512x512',
          type : 'image/png',
          purpose : 'maskable'
        }
      ]
    };
  }
}
