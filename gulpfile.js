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

const linter = () => {
  return eslint({
    'parserOptions': {
      'ecmaVersion': 2017
    },
    'env': {
      'es6': true,
      'browser': true
    },
    'globals': [
      'console',
      'document',
      'module',
      'require',
      'window',
      'Buffer'
    ],
    'rules': {
      'array-bracket-spacing': 1,
      'brace-style': 1,
      'comma-spacing': 1,
      'eqeqeq': 1,
      'indent': ['error', 2, { 'SwitchCase': 1 }],
      'keyword-spacing': 1,
      'no-mixed-spaces-and-tabs': 1,
      'no-undef': 1,
      'no-unused-vars': 1,
      'no-var': 1,
      'object-shorthand': [1, 'methods'],
      'prefer-arrow-callback': 1,
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
      'space-before-blocks': 1,
      'space-infix-ops': 1
    }
  });
};

// Useful resources
//  * https://www.smashingmagazine.com/2014/06/building-with-gulp/
//  * https://github.com/gulpjs/gulp/tree/master/docs/recipes

gulp.task('clean', () => {
  return del(['./dist/*']);
});

gulp.task('server-lint', () => {
  return gulp.src(['./server/*.js', './config/config.js', './test/**/*.js', 'gulpfile.js'])
    .pipe(linter())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('server-build', () => {
  const shellFilter = filter('**/*.sh', {restore: true});
  return gulp.src([
    './install.sh',
    './uninstall.sh',
    './package.json',
    './package-lock.json',
    './scanservjs.service',
    './*config/**/*.js',
    './*server/**/*',
    './*data/**/*.md',
    './*data/**/default.jpg'])
    .pipe(shellFilter)
    .pipe(chmod(0o755))
    .pipe(shellFilter.restore)
    .pipe(gulp.dest('./dist/'));
});

gulp.task('package', () => {
  const filename = `scanservjs_v${version}_${dayjs().format('YYYYMMDD.HHmmss')}.tar`;
  const shellFilter = filter('**/*.sh', {restore: true});
  return gulp.src('./dist/**/*')
    // Filter to shell scripts and chmod +x
    .pipe(shellFilter)
    .pipe(chmod(0o755))
    .pipe(shellFilter.restore)
    // Now chmod all dirs +x
    .pipe(chmod(null, 0o755))
    .pipe(tar(filename))
    .pipe(gzip())
    .pipe(gulp.dest('./release'));
});

/*
Development helpers below. These tasks rely on running a command line which is
not available in all circumstances.
*/

gulp.task('client-build', () => {
  return run('npm run client-build').exec();
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
