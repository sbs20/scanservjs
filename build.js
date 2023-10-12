const dayjs = require('dayjs');
const fse = require('fs-extra');
const tar = require('tar');
const version = require('./package.json').version;
const dist = './dist/core';
const release = './release';
const options = { overwrite: true };
const args = process.argv.slice(2);

async function assemble() {
  await fse.copy('./app-ui/dist', `${dist}/client`, options);
  await fse.copy('./app-server/dist', `${dist}`, options);
  await fse.copy('./app-assets', `${dist}`, options);
  await fse.copy('./package-lock.json', `${dist}/package-lock.json`, options);
  await fse.chmod(`${dist}/installer.sh`, 0o755);
}

async function distribution() {
  await fse.mkdir(release, {recursive: true});
  const filename = `scanservjs_v${version}_${dayjs().format('YYYYMMDD.HHmmss')}.tar.gz`;
  await tar.c({
    cwd: dist,
    gzip: true,
    file: `${release}/${filename}`
  }, [ './' ]);
}

async function run() {
  if (args.includes('--assemble')) {
    await assemble();
  }
  
  if (args.includes('--package')) {
    await distribution();
  }  
}

run();
