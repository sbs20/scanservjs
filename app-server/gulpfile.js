const chmod = require('gulp-chmod');
const eslint = require('gulp-eslint');
const { dest, src } = require('gulp');
const filter = require('gulp-filter');
const merge = require('merge-stream');

const DIST = './dist/';

// Useful resources
//  * https://www.smashingmagazine.com/2014/06/building-with-gulp/
//  * https://github.com/gulpjs/gulp/tree/master/docs/recipes

exports.lint = () => {
  return src(['./src/**/*.js', './config/config.default.js', './test/**/*.js', 'gulpfile.js'])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
};

exports.build = () => {
  const shellFilter = filter('**/*.sh', { restore: true });

  const common = src([
    './package.json',
    './*config/**/config.default.js',
    './*data/**/default.jpg'])
    .pipe(shellFilter)
    .pipe(chmod(0o755))
    .pipe(shellFilter.restore)
    .pipe(dest(DIST));

  const source = src(['./src/**/*'])
    .pipe(dest(`${DIST}/server/`));

  return merge(common, source);
};

exports.default = exports.build;
