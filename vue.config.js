const configure = require('./server/configure')
const path = require("path");

module.exports = {
  devServer: {
    before: configure
  },
  pages: {
    index: {
      entry: 'client/main.js',
      template: 'client/index.html',
      favicon: 'client/favicon.ico',
      filename: 'index.html',
      title: 'scanserv-js',
      chunks: ['chunk-vendors', 'chunk-common', 'index']
    }
  },
  outputDir: path.resolve(__dirname, "./dist/client")
}