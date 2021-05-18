const version = require('./package.json').version;
const dayjs = require('dayjs');
const chmod = require('gulp-chmod');
const eslint = require('gulp-eslint');
const { dest, series, src } = require('gulp');
const gzip = require('gulp-gzip');
const filter = require('gulp-filter');
const tar = require('gulp-tar');
const merge = require('merge-stream');

const DIST = '../../dist/';
const RELEASE = '../../release/';

const linter = () => {
  return eslint();
};

// Useful resources
//  * https://www.smashingmagazine.com/2014/06/building-with-gulp/
//  * https://github.com/gulpjs/gulp/tree/master/docs/recipes

const app = {
  server: {
    lint: () => {
      return src(['./src/*.js', './config/config.default.js', './test/**/*.js', 'gulpfile.js'])
        .pipe(linter())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
    },
  
    build: () => {
      const shellFilter = filter('**/*.sh', {restore: true});
  
      const common = src([
        './installer.sh',
        './scanservjs.service',
        './package.json',
        './package-lock.json',
        './*config/**/config.default.js',
        './*data/**/default.jpg'])
        .pipe(shellFilter)
        .pipe(chmod(0o755))
        .pipe(shellFilter.restore)
        .pipe(dest(DIST));
    
      const source = src(['./src/**/*'])
        .pipe(dest(`${DIST}/server/`));
    
      return merge(common, source);  
    },
  },
  
  package: () => {
    const filename = `scanservjs_v${version}_${dayjs().format('YYYYMMDD.HHmmss')}.tar`;
    const shellFilter = filter('**/*.sh', {restore: true});
    return src(`${DIST}**/*`)
      // Filter to shell scripts and chmod +x
      .pipe(shellFilter)
      .pipe(chmod(0o755))
      .pipe(shellFilter.restore)
      // Now chmod all dirs +x
      .pipe(chmod(undefined, 0o755))
      .pipe(tar(filename))
      .pipe(gzip())
      .pipe(dest(RELEASE));
  }
};

exports.lint = app.server.lint;
exports.build = app.server.build;
exports.package = app.package;
exports.default = series(exports.build);
