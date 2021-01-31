/** @type {import('vls').VeturConfig} */
module.exports = {
  projects: [
    './webui',
    {
      root: './webui',
      package: './package.json',
      jsconfig: './jsconfig.json',
      globalComponents: [
        './src/components/**/*.vue'
      ]
    }
  ]
}
