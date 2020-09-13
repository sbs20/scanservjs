const configure = require('./server/Configure')
const path = require("path");

module.exports = {
  devServer: {
    before: configure
  },
  pages: {
    index: {
      // entry for the page
      entry: 'client/main.js',
      // the source template
      template: 'client/index.html',
      // output as dist/index.html
      filename: 'index.html',
      // when using title option,
      // template title tag needs to be <title><%= htmlWebpackPlugin.options.title %></title>
      title: 'scanserv-js',
      // chunks to include on this page, by default includes
      // extracted common chunks and vendor chunks.
      chunks: ['chunk-vendors', 'chunk-common', 'index']
    }
  },
  outputDir: path.resolve(__dirname, "./dist/client")
}