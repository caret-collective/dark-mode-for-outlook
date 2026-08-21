; (async () => {
	'use strict';

	// Deps
	const archiver = require('archiver');
	const fs = require('fs-extra');
	const { join } = require('path');
	const { performance } = require('perf_hooks');
	const NoBS = require('nobs');
	const replace = require('replace-in-file');
	const { renderSync } = require('sass');
	const sharp = require('sharp');


	// Constants
	const buildFolder = 'build';
	const firefoxSubfolder = join(buildFolder, 'firefox');
	const chromiumSubfolder = join(buildFolder, 'chromium');
	const deliverablesFolder = join(buildFolder, 'deliverables');
	const localeFolder = '_locales';
	const imgFolder = 'img';
	const iconFilename = 'icon.svg';
	const packageJson = 'package.json';
	const manifestJson = 'manifest.json';
	const storeListingTxt = 'store-listing.txt';
	const scssFiles = ['css/main.scss', 'css/help.scss', 'css/compose.scss'];
	const filesToCopy = ['README.md', 'LICENSE', manifestJson, 'options.html', 'js/options.js', 'js/background.js', 'js/content.js', localeFolder];


	// Runtime vars
	let extensionName;
	let extensionVersion;


	// Get extension name and version from package.json
	const getExtensionDetails = async () => {
		return new Promise(async (resolve, reject) => {
			try {
				const packageObj = await fs.readJson(packageJson);

				// TODO: Use destructuring here
				extensionName = packageObj.name;
				extensionVersion = packageObj.version.replace('.0', '');

				resolve();
			} catch (error) {
				reject(error);
			}
		});
	};


	// Create a build folder if it doesn't exist already, otherwise empty it
	const cleanBuildFolder = async () => {
		return new Promise(async (resolve, reject) => {
			try {
				await fs.emptyDir(buildFolder);
				await Promise.all([fs.emptyDir(firefoxSubfolder), fs.emptyDir(chromiumSubfolder), fs.emptyDir(deliverablesFolder)]);

				resolve();
			} catch (error) {
				reject(error);
			}
		});
	};


	// Customize manifest for different extension variants so that warnings aren't shown on install:
	// - For Chromium, remove "browser_specific_settings" section
	// - For Firefox, make background page persistent)
	const customizeManifests = async () => {
		return new Promise(async (resolve, reject) => {
			try {
				const chromiumResult = await replace({
					files: join(chromiumSubfolder, manifestJson),
					from: /\t{0,4}"browser_specific_settings": ?[\s\S]{0,128}\},\s/,
					to: '',
					countMatches: true,
					disableGlobs: true,
				});

				const firefoxResult = await replace({
					files: join(firefoxSubfolder, manifestJson),
					from: /"persistent": ?false/,
					to: '"persistent": true',
					countMatches: true,
					disableGlobs: true,
				});

				if (!chromiumResult || chromiumResult.length != 1 || !chromiumResult[0].hasChanged) {
					throw new Error(`Section "browser_specific_settings" could not be found in ${manifestJson}`);
				} else if (!firefoxResult || firefoxResult.length != 1 || !firefoxResult[0].hasChanged) {
					throw new Error(`Option "persistent" could not be found in ${manifestJson}`);
				}

				resolve();
			} catch (error) {
				reject(error);
			}
		});
	};


	// Duplicate Firefox build folder to make other build variants
	const duplicateBuildFolder = async () => {
		return new Promise(async (resolve, reject) => {
			try {
				await fs.copy(firefoxSubfolder, chromiumSubfolder);

				resolve();
			} catch (error) {
				reject(error);
			}
		});
	};


	// Generate extension icons in multiple sizes
	const generateIcons = async () => {
		return new Promise(async (resolve, reject) => {
			try {
				const outputImgFolder = join(firefoxSubfolder, imgFolder);

				await fs.ensureDir(outputImgFolder);
				await Promise.all([128, 64, 48, 32, 16].map(size => {
					return sharp(join(imgFolder, iconFilename))
						.resize(size, size)
						.png({
							compressionLevel: 9,
							adaptiveFiltering: true,
							palette: true
						})
						.toFile(join(outputImgFolder, `${size}.png`));
				}));

				resolve();
			} catch (error) {
				reject(error);
			}
		});
	};


	// Compile SCSS to CSS
	const compileScss = async () => {
		return new Promise(async (resolve, reject) => {
			try {
				await Promise.all(scssFiles.map(filename => {
					const css = renderSync({
						file: filename,
						outputStyle: 'compressed',
						sourceMap: false
					}).css;

					return fs.outputFile(join(firefoxSubfolder, filename.replace('.scss', '.css')), css);
				}));

				resolve();
			} catch (error) {
				reject(error);
			}
		});
	};


	// Copy source files to build folder
	const copyFiles = async () => {
		return new Promise(async (resolve, reject) => {
			try {
				const copyTasks = filesToCopy.map(filename => {
					return fs.copy(filename, join(firefoxSubfolder, filename), {
						filter: file => {
							// Filter out store-listing.txt files because we will generate these later
							return !file.includes(storeListingTxt);
						}
					});
				});

				await Promise.all(copyTasks);

				resolve();
			} catch (error) {
				reject(error);
			}
		});
	};


	// Generate complete store listing descriptions from localized store-listing.txt files
	const generateStoreListings = async () => {
		return new Promise(async (resolve, reject) => {
			try {
				const localeCodes = (() => fs.readdirSync(localeFolder)
					.filter(filename => fs.statSync(join(localeFolder, filename)).isDirectory())
				)();

				if (localeCodes !== null) {
					const writeTasks = localeCodes.flatMap(localeCode => {
						const text = fs.readFileSync(join(localeFolder, localeCode, storeListingTxt)).toString();
						const textForOpera = text.replace(/(?:🔶|🔸)/g, '♦').replace(/🙂/g, ':)');

						return [
							fs.writeFile(join(deliverablesFolder, `store-listing-${localeCode}.txt`), text),
							fs.writeFile(join(deliverablesFolder, `store-listing-${localeCode}-opera.txt`), textForOpera)
						];
					});

					await Promise.all(writeTasks);
				}

				resolve();
			} catch (error) {
				reject(error);
			}
		});
	};


	// Helper function to zip files and folders
	const zip = async (inputFolder, globPattern, ignoreGlobPatterns, outputFolder, filenameLabel) => {
		return new Promise(async (resolve, reject) => {
			const filename = `${extensionName}-${extensionVersion}-${filenameLabel}.zip`;
			const output = fs.createWriteStream(join(outputFolder, filename));
			const archive = archiver('zip', {
				zlib: { level: 9 }
			});

			// Fired once all archive data has been written
			output.on('close', () => resolve());
			archive.on('error', error => reject(error));

			// Zip all files and place in root directory of zip, excluding certain files/folders
			archive.pipe(output);
			archive.glob(globPattern, { cwd: inputFolder, ignore: ignoreGlobPatterns }, { prefix: '' });

			// Finalize the archive. We still need to wait for streams to finish
			archive.finalize();
		});
	};


	// Create zip file of the Chromium build folder
	const zipChromiumBuildFolder = async () => {
		return new Promise(async (resolve, reject) => {
			try {
				await zip(chromiumSubfolder, '**', [], buildFolder, 'chromium');

				resolve();
			} catch (error) {
				reject(error);
			}
		});
	};


	// Create zip file of the Firefox build folder
	const zipFirefoxBuildFolder = async () => {
		return new Promise(async (resolve, reject) => {
			try {
				await zip(firefoxSubfolder, '**', [], buildFolder, 'firefox');

				resolve();
			} catch (error) {
				reject(error);
			}
		});
	};


	// Create zip file of the project source code (required by Firefox web store)
	const zipSourceCode = async () => {
		return new Promise(async (resolve, reject) => {
			try {
				await zip('', '**', ['node_modules/**', 'build/**'], deliverablesFolder, 'source-firefox');

				resolve();
			} catch (error) {
				reject(error);
			}
		});
	};


	const main = () => {
		// Items in this array are completed sequentially. Tasks on the same level are run concurrently to save time
		const taskList = [
			[getExtensionDetails, cleanBuildFolder],
			[copyFiles, compileScss, generateIcons, zipSourceCode, generateStoreListings],
			[duplicateBuildFolder],
			[customizeManifests],
			[zipFirefoxBuildFolder, zipChromiumBuildFolder]
		];

		const noBS = new NoBS(taskList);
		const startTime = performance.now();

		console.log('Starting build\n');

		noBS.run()
			.then(result => console.log(`\nFinished in ${((performance.now() - startTime) / 1000).toFixed(2)} seconds\n`))
			.catch(error => console.error(`\nError: ${error}\n`));
	}


	main();
})();
