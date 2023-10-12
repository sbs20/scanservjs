const fse = require('fs-extra');
const dist = './dist';
const options = { overwrite: true };

async function assemble() {
  await fse.copy('./src', `${dist}/server`, options);
  [
    'package.json',
    'config/config.default.js',
    'data/preview/default.jpg'
  ].forEach(async path => await fse.copy(path, `${dist}/${path}`, options));
}

assemble();
