/** @type {import('vls').VeturConfig} */
module.exports = {
  projects: [
    './app-ui',
    {
      root: './app-ui',
      package: './package.json',
      jsconfig: './jsconfig.json',
      globalComponents: [
        './src/components/**/*.vue'
      ]
    }
  ]
}
