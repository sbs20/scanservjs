const version = require('./package.json').version;
const dayjs = require('dayjs');
const chmod = require('gulp-chmod');
const del = require('del');
const eslint = require('gulp-eslint');
const { dest, series, src } = require('gulp');
const gzip = require('gulp-gzip');
const filter = require('gulp-filter');
const run = require('gulp-run');
const tar = require('gulp-tar');
const merge = require('merge-stream');

const DIST = '../dist/';
const RELEASE = '../release/';

const linter = () => {
  return eslint();
};

// Useful resources
//  * https://www.smashingmagazine.com/2014/06/building-with-gulp/
//  * https://github.com/gulpjs/gulp/tree/master/docs/recipes

const app = {
  clean: () => {
    return del([`${DIST}*`], { force: true });
  },

  client: {
    build: () => {
      return run('npm run build', { cwd: '../webui'}).exec();
    }
  },

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
        './bin/installer.sh',
        './bin/scanservjs.service',
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
  
    test: () => {
      return run('npm run test').exec();
    }
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

exports['clean'] = app.clean;
exports['server-lint'] = app.server.lint;
exports['server-build'] = app.server.build;
exports['build'] = series(app.clean, app.server.lint, app.server.test, app.client.build, app.server.build);
exports['package'] = app.package;
exports['release'] = series(exports['build'], app.package);
exports['default'] = series(exports['build']);
