var gulp = require('gulp');
var concat = require('gulp-concat');
var browserify = require('browserify');
var browserifyshim = require('browserify-shim');
var source = require('vinyl-source-stream');
var del = require('del');

// See recipes: https://github.com/gulpjs/gulp/tree/master/docs/recipes

gulp.task('clean', function () {
    return del([
        './assets/*',
        './build/*'
    ]);
});

gulp.task('js', function () {
    var b = browserify({
        entries: './src/client.js',
        debug: true,
    });

    return b.bundle()
        .pipe(source('app.js'))
        .pipe(gulp.dest('./assets/js/'));
});

gulp.task('css', function () {
    return gulp.src([
            './node_modules/jqueryui/**/*.min.css',
            './node_modules/jquery-jcrop/**/*.min.css',
            './node_modules/toastr/**/*.min.css',
            './node_modules/bootstrap/dist/**/*.min.css',
            './src/client.css'
        ])
        .pipe(concat('app.css'))
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

gulp.task('compile', ['files', 'css', 'js']);

gulp.task('build', ['compile'], function () {
    return gulp.src([
            './index.html',
            './install.sh',
            './package.json',
            './npm-shrinkwrap.json',
            './scanservjs.service',
            './server.js',
            './*assets/**/*',
            './*classes/**/*',
            './*data/**/*.md',
        ])
        .pipe(gulp.dest('./build'));
});

gulp.task('rebuild', ['clean'], function () {
    
});

gulp.task('default', [
    'build'
]);