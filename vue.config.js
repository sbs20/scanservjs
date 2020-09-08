const configure = require('./src/server/Configure')
const path = require("path");

module.exports = {
  devServer: {
    before: configure
  },
  pages: {
    index: {
      // entry for the page
      entry: 'src/client/main.js',
      // the source template
      template: 'src/index.html',
      // output as dist/index.html
      filename: 'index.html',
      // when using title option,
      // template title tag needs to be <title><%= htmlWebpackPlugin.options.title %></title>
      title: 'ScanservJS',
      // chunks to include on this page, by default includes
      // extracted common chunks and vendor chunks.
      chunks: ['chunk-vendors', 'chunk-common', 'index']
    }
    // when using the entry-only string format,
    // template is inferred to be `public/subpage.html`
    // and falls back to `public/index.html` if not found.
    // Output filename is inferred to be `subpage.html`.
    //subpage: 'src/subpage/main.js'
  },
  outputDir: path.resolve(__dirname, "./dist/client")
}