var gulp = require('gulp');
var uglify = require('gulp-uglify');
var jshint = require('gulp-jshint');
var concat = require('gulp-concat');
var chmod = require('gulp-chmod');
var filter = require('gulp-filter');
var tar = require('gulp-tar');
var gzip = require('gulp-gzip');

var browserify = require('browserify');
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

gulp.task('server-js', gulp.series(['inspect'], function () {
    return gulp.src(['server.js', './classes/*.js'])
        .pipe(jshint())
        .pipe(jshint.reporter('default'));        
}));

gulp.task('client-js', gulp.series(['inspect'], function () {
    return browserify({
        entries: './src/client.js',
        debug: true,
    }).bundle()
        .pipe(source('app.js'))
        .pipe(buffer()) // convert from streaming to buffered vinyl file object
        .pipe(uglify()) // now gulp-uglify works 
        .pipe(gulp.dest('./assets/js/'));
}));

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

gulp.task('files', function (done) {
    gulp.src('./node_modules/bootstrap/dist/fonts/glyph*').pipe(gulp.dest('./assets/fonts'));
    gulp.src('./node_modules/jquery-jcrop/css/Jcrop.gif').pipe(gulp.dest('./assets/css'));
    gulp.src('./node_modules/jqueryui/images/ui-*.png').pipe(gulp.dest('./assets/css/images'));
    done();
});

gulp.task('compile', gulp.series(['files', 'css', 'client-js', 'server-js'], function(done) {
    done();
}));

gulp.task('build', gulp.series(['compile'], function () {
    return gulp.src([
        './index.html',
        './install.sh',
        './uninstall.sh',
        './package.json',
        './package-lock.json',
        './scanservjs.service',
        './server.js',
        './*assets/**/*',
        './*classes/**/*',
        './*data/**/*.md',
    ]).pipe(gulp.dest('./build/scanservjs'));
}));

gulp.task('package', gulp.series(['build'], function () {
    var filename = 'scanservjs_' + dateFormat(new Date(), 'yyyymmdd.HHMMss') + '.tar';
    var shellFilter = filter('**/*.sh', {restore: true})
    return gulp.src('./build/**/*')
        // Filter to shell scripts and chmod +x
        .pipe(shellFilter)
        .pipe(chmod(0o755))
        .pipe(shellFilter.restore)
        // Now chmod all dirs +x
        .pipe(chmod(null, 0o755))
        .pipe(tar(filename))
        .pipe(gzip())
        .pipe(gulp.dest('./release'));
}));

gulp.task('deploy', gulp.series(['build'], function () {
    return gulp.src('./build/**/*.*')
        .pipe(gulp.dest(options.dest));
}));

gulp.task('default', gulp.series(['build'], function(done) {
    done();
}));
