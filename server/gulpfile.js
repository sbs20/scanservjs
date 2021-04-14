const version = require('./package.json').version;
const dayjs = require('dayjs');
const chmod = require('gulp-chmod');
const del = require('del');
const eslint = require('gulp-eslint');
const gulp = require('gulp');
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

gulp.task('clean', () => {
  return del([`${DIST}*`], { force: true });
});

gulp.task('server-lint', () => {
  return gulp.src(['./src/*.js', './config/config.default.js', './test/**/*.js', 'gulpfile.js'])
    .pipe(linter())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('server-build', () => {
  const shellFilter = filter('**/*.sh', {restore: true});

  const common = gulp.src([
    './bin/installer.sh',
    './bin/scanservjs.service',
    './package.json',
    './package-lock.json',
    './*config/**/config.default.js',
    './*data/**/default.jpg'])
    .pipe(shellFilter)
    .pipe(chmod(0o755))
    .pipe(shellFilter.restore)
    .pipe(gulp.dest(DIST));

  const src = gulp.src(['./src/**/*'])
    .pipe(gulp.dest(`${DIST}/server/`));

  return merge(common, src);
});

gulp.task('package', () => {
  const filename = `scanservjs_v${version}_${dayjs().format('YYYYMMDD.HHmmss')}.tar`;
  const shellFilter = filter('**/*.sh', {restore: true});
  return gulp.src(`${DIST}**/*`)
    // Filter to shell scripts and chmod +x
    .pipe(shellFilter)
    .pipe(chmod(0o755))
    .pipe(shellFilter.restore)
    // Now chmod all dirs +x
    .pipe(chmod(null, 0o755))
    .pipe(tar(filename))
    .pipe(gzip())
    .pipe(gulp.dest(RELEASE));
});

/*
Development helpers below. These tasks rely on running a command line which is
not available in all circumstances.
*/

gulp.task('client-build', () => {
  return run('npm run build', { cwd: '../webui'}).exec();
});

gulp.task('test', () => {
  return run('npm run test').exec();
});

gulp.task('build', gulp.series(['clean', 'server-lint', 'client-build', 'server-build', 'test'], (done) => {
  done();
}));

gulp.task('release', gulp.series(['build', 'package'], (done) => {
  done();
}));

gulp.task('default', gulp.series(['build'], (done) => {
  done();
}));
