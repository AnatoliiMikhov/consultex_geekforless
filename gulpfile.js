const { src, dest, series, parallel } = require('gulp'),
	browserSync = require('browser-sync').create(),
	fileinclude = require('gulp-file-include'),
	del = require('del'),
	sass = require('gulp-sass'),
	autoprefixer = require('gulp-autoprefixer'),
	groupMedia = require('gulp-group-css-media-queries'),
	cleanCSS = require('gulp-clean-css'),
	rename = require('gulp-rename'),
	webpack = require('webpack-stream'),
	imagemin = require('gulp-imagemin'),
	watch = require('gulp-watch'),
	webp = require('gulp-webp'),
	webp2html = require('gulp-webp-in-html'),
	webpcss = require('gulp-webpcss'),
	ttf2woff = require('gulp-ttf2woff'),
	ttf2woff2 = require('gulp-ttf2woff2'),
	sourcemaps = require('gulp-sourcemaps'),
	fs = require('fs');

// ===========================================================================
// const dist = '/var/www/dev/assembly_gulp/';
// const dist = 'dist';
const dist = require('path').basename(__dirname);

const distFolder = dist,
	sourceFolder = 'src',
	path = {
		build: {
			html: distFolder + '/',
			css: distFolder + '/css/',
			js: distFolder + '/js/',
			img: distFolder + '/img/',
			fonts: distFolder + '/fonts/',
		},
		src: {
			html: [sourceFolder + '/*.html', '!' + sourceFolder + '/_*.html'],
			css: sourceFolder + '/sass/style.scss',
			js: sourceFolder + '/js/script.js',
			img: sourceFolder + '/img/**/*.{jpg,jpeg,png,svg,gif,ico,webp}',
			fonts: sourceFolder + '/fonts/*.ttf',
		},
		watch: {
			html: sourceFolder + '/**/*.html',
			css: sourceFolder + '/sass/**/*.+(scss|sass)',
			js: sourceFolder + '/js/**/*.js',
			img: sourceFolder + '/img/**/*.{jpg,jpeg,png,svg,gif,ico,webp}',
		},
		clean: './' + distFolder + '/',
	};

// ===========================================================================
function server() {
	browserSync.init({
		server: {
			baseDir: './' + distFolder + '/',
		},
		port: 4000,
		notify: false,
	});
}

// html files work ===========================================================

function html() {
	return src(path.src.html)
		.pipe(fileinclude())
		.pipe(webp2html())
		.pipe(dest(path.build.html))
		.pipe(browserSync.stream());
}

// sass scss func ============================================================

function styles() {
	return src(path.src.css)
		.pipe(sourcemaps.init())
		.pipe(
			sass({
				outputStyle: 'expanded',
			}).on('error', sass.logError)
		)
		.pipe(groupMedia())
		.pipe(autoprefixer())
		.pipe(
			webpcss({
				webpClass: '',
				noWebpClass: '.no-webp',
			})
		)
		.pipe(dest(path.build.css))
		.pipe(cleanCSS({ compatibility: 'ie8' }))
		.pipe(rename({ suffix: '.min', prefix: '' }))
		.pipe(sourcemaps.write('./'))
		.pipe(dest(path.build.css))
		.pipe(browserSync.stream());
}

// scripts ===================================================================

function scriptJS() {
	return src(path.src.js)
		.pipe(
			webpack({
				mode: 'production',
				output: {
					filename: 'script.min.js',
				},
				watch: false,
				devtool: 'source-map',
				module: {
					rules: [
						{
							test: /\.m?js$/,
							exclude: /(node_modules|bower_components)/,
							use: {
								loader: 'babel-loader',
								options: {
									presets: [
										[
											'@babel/preset-env',
											{
												debug: true,
												corejs: 3,
												useBuiltIns: 'usage',
											},
										],
									],
								},
							},
						},
					],
				},
			})
		)
		.pipe(dest(path.build.js))
		.on('end', browserSync.reload);
}

// images =====================================================================

function img2webp() {
	return src(path.src.img)
		.pipe(webp({ quality: 70 }))
		.pipe(dest(path.build.img))
		.pipe(browserSync.stream());
}

function images() {
	return src(path.src.img)
		.pipe(
			imagemin(
				[
					imagemin.gifsicle({ interlaced: true }),
					imagemin.mozjpeg({ quality: 75, progressive: true }),
					imagemin.optipng({ optimizationLevel: 3 }),
					imagemin.svgo({
						plugins: [{ removeViewBox: false }],
					}),
				],
				{ verbose: true }
			)
		)
		.pipe(dest(path.build.img))
		.pipe(browserSync.stream());
}

// fonts ======================================================================

async function fonts() {
	await src(path.src.fonts).pipe(ttf2woff()).pipe(dest(path.build.fonts));
	return await src(path.src.fonts).pipe(ttf2woff2()).pipe(dest(path.build.fonts));
}

async function fontsStyle() {
	let fileContent = fs.readFileSync(sourceFolder + '/sass/fonts/fonts.scss');
	if (fileContent == '') {
		fs.writeFile(sourceFolder + '/sass/fonts/fonts.scss', '', cb);
		return await fs.readdir(path.build.fonts, function (err, items) {
			if (items) {
				let cFontname;
				for (let i = 0; i < items.length; i++) {
					let fontname = items[i].split('.');
					fontname = fontname[0];
					if (cFontname != fontname) {
						fs.appendFile(
							sourceFolder + '/sass/fonts/fonts.scss',
							'@include font("' + fontname + '", "' + fontname + '", "400", "normal");\r\n',
							cb
						);
					}
					cFontname = fontname;
				}
			}
		});
	}
}
function cb() {}

// watch files ================================================================

function watchFiles() {
	watch([path.watch.html], html);
	watch([path.watch.css], styles);
	watch([path.watch.js], scriptJS);
	watch(
		[path.watch.img],
		{
			usePolling: false,
			ignoreInitial: true,
		},
		images
	);
	watch(
		[path.watch.img],
		{
			usePolling: false,
			ignoreInitial: true,
		},
		img2webp
	);
}

// clean dist catalog ========================================================

async function cleanDist() {
	return await del(path.clean);
}

// =============================================================================

const build = series(
	cleanDist,
	fonts,
	fontsStyle,
	parallel(images, img2webp),
	parallel(scriptJS, styles, html)
);

const watchTask = series(build, parallel(watchFiles, server));

// =============================================================================
exports.cleanDist = cleanDist;
exports.fonts = fonts;
exports.fontsStyle = fontsStyle;
exports.build = build;
exports.watchTask = watchTask;
exports.default = watchTask;
