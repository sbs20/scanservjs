let packageJson = null;

try {
  packageJson = require('../package.json');
  console.log('Found ../package.json.');
} catch (cause) {
  packageJson = require('../../package.json');
  console.log('Found ../../package.json (Development mode).');
}

const Package = {
  version: packageJson.version,
};

module.exports = Package;