const fse = require('fs-extra');
const dist = './dist';
const options = { overwrite: true };

async function assemble() {
  await fse.copy('./app-ui/dist', `${dist}/client`, options);
  await fse.copy('./app-server/dist', `${dist}`, options);
  await fse.copy('./package-lock.json', `${dist}/package-lock.json`, options);
}

assemble();
