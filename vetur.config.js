/** @type {import('vls').VeturConfig} */
module.exports = {
  projects: [
    './packages/client',
    {
      root: './packages/client',
      package: './package.json',
      jsconfig: './jsconfig.json',
      globalComponents: [
        './src/components/**/*.vue'
      ]
    }
  ]
}
