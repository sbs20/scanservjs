var gulp = require('gulp');
var uglify = require('gulp-uglify');
var jshint = require('gulp-jshint');
var concat = require('gulp-concat');
var zip = require('gulp-zip');
var browserify = require('browserify');
var browserifyshim = require('browserify-shim');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var del = require('del');
var dateFormat = require('dateformat');
var minimist = require('minimist');

var knownOptions = {
  string: 'dest',
  default: { dest: '/var/www/scanservjs' }
};

var options = minimist(process.argv.slice(2), knownOptions);

// Useful resources
//  * https://www.smashingmagazine.com/2014/06/building-with-gulp/
//  * https://github.com/gulpjs/gulp/tree/master/docs/recipes

gulp.task('clean', function () {
    return del([
        './assets/*',
        './build/*',
        './release/*'
    ]);
});

gulp.task('inspect', function () {
    return gulp.src('./src/client.js')
        .pipe(jshint())
        .pipe(jshint.reporter('default'));        
});

gulp.task('server-js', ['inspect'], function () {
    gulp.src(['server.js', './classes/*.js'])
        .pipe(jshint())
        .pipe(jshint.reporter('default'));        
});

gulp.task('client-js', ['inspect'], function () {
    var b = browserify({
        entries: './src/client.js',
        debug: true,
    });

    return b.bundle()
        .pipe(source('app.js'))
        .pipe(buffer()) // convert from streaming to buffered vinyl file object
        .pipe(uglify()) // now gulp-uglify works 
        .pipe(gulp.dest('./assets/js/'));
});

gulp.task('css', function () {
    return gulp.src([
        './node_modules/jqueryui/**/*.min.css',
        './node_modules/jquery-jcrop/**/*.min.css',
        './node_modules/toastr/**/*.min.css',
        './node_modules/bootstrap/dist/**/*.min.css',
        './src/client.css'
    ]).pipe(concat('app.css'))
        .pipe(gulp.dest('./assets/css'));
});

gulp.task('files', function () {
    var streams = [
        gulp.src('./node_modules/bootstrap/dist/fonts/glyph*').pipe(gulp.dest('./assets/fonts')),
        gulp.src('./node_modules/jquery-jcrop/css/Jcrop.gif').pipe(gulp.dest('./assets/css')),
        gulp.src('./node_modules/jqueryui/images/ui-*.png').pipe(gulp.dest('./assets/css/images')),
    ];

    return streams;
});

gulp.task('compile', ['files', 'css', 'client-js', 'server-js']);

gulp.task('build', ['compile'], function () {
    return gulp.src([
        './index.html',
        './install.sh',
        './uninstall.sh',
        './package.json',
        './npm-shrinkwrap.json',
        './scanservjs.service',
        './server.js',
        './*assets/**/*',
        './*classes/**/*',
        './*data/**/*.md',
    ]).pipe(gulp.dest('./build'));
});

gulp.task('package', ['build'], function () {
    var filename = 'scanservjs_' + dateFormat(new Date(), 'yyyymmdd.HHMMss') + '.zip';
    return gulp.src('./build/**/*')
        .pipe(zip(filename))
        .pipe(gulp.dest('./release'));
});

gulp.task('deploy', ['build'], function () {
    return gulp.src('./build/**/*.*')
        .pipe(gulp.dest(options.dest));
});

gulp.task('default', [
    'build'
]);
