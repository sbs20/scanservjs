const fse = require('fs-extra');
const dist = './dist';
const options = { overwrite: true };

async function assemble() {
  await fse.copy('./app-ui/dist', `${dist}/client`, options);
  await fse.copy('./app-server/dist', `${dist}`, options);
}

assemble();
