const version = require('./package.json').version;
const dayjs = require('dayjs');
const chmod = require('gulp-chmod');
const { dest, series, src } = require('gulp');
const gzip = require('gulp-gzip');
const filter = require('gulp-filter');
const tar = require('gulp-tar');
const merge = require('merge-stream');

const DIST = './dist';
const RELEASE = './release';

// Useful resources
//  * https://www.smashingmagazine.com/2014/06/building-with-gulp/
//  * https://github.com/gulpjs/gulp/tree/master/docs/recipes

exports.assemble = () => {
  const ui = src(['./app-ui/dist/**'])
    .pipe(dest(`${DIST}/client`));

  const api = src(['./app-server/dist/**'])
    .pipe(dest(DIST));

  const shellFilter = filter('**/*.sh', {restore: true});
  const assets = src(['./app-assets/**', 'package-lock.json'])
    .pipe(shellFilter)
    .pipe(chmod(0o755))
    .pipe(shellFilter.restore)
    .pipe(dest(DIST));

  return merge(ui, api, assets);
};

exports.package = () => {
  const filename = `scanservjs_v${version}_${dayjs().format('YYYYMMDD.HHmmss')}.tar`;
  return src(`${DIST}/**/*`)
    // chmod all dirs +x
    .pipe(chmod(undefined, 0o755))
    .pipe(tar(filename))
    .pipe(gzip())
    .pipe(dest(RELEASE));
};

exports.default = series(exports.assemble);
