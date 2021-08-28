process.env.VUE_APP_VERSION = require('./package.json').version;
const configure = require('../server/src/configure');
const path = require('path');

module.exports = {
  publicPath: '',
  
  css: {
    loaderOptions: {
      sass: {
        additionalData: '@import "./src/styles/variables.scss"'
      },      
    }
  },

  devServer: {
    before: app => {
      configure(app, '../server/');
    },
    disableHostCheck: true
  },

  pages: {
    index: {
      entry: 'src/main.js',
      template: 'src/index.html',
      favicon: 'src/favicon.ico',
      filename: 'index.html',
      title: 'scanserv-js',
      chunks: ['chunk-vendors', 'chunk-common', 'index']
    }
  },

  outputDir: path.resolve(__dirname, '../../dist/client'),

  pluginOptions: {
    i18n: {
      locale: 'en',
      fallbackLocale: 'en',
      localeDir: 'locales',
      enableInSFC: false
    }
  }
};
