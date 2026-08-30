import archiver from 'archiver';
import * as fs from 'fs-extra';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import NoBS from 'nobs';
import replace from 'replace-in-file';
import { compile } from 'sass';
import sharp from 'sharp';

type BuildTask = () => Promise<void>;
type PackageJson = {
	name: string;
	version: string;
};

// Constants
const buildFolder = 'build';
const firefoxSubfolder = join(buildFolder, 'firefox');
const chromiumSubfolder = join(buildFolder, 'chromium');
const deliverablesFolder = join(buildFolder, 'deliverables');
const sourceFolder = 'src';
const imagesFolder = 'images';
const localeFolder = '_locales';
const iconFilename = 'icon.svg';
const scriptsFolder = 'scripts';
const stylesFolder = 'styles';
const packageJson = 'package.json';
const manifestJson = 'manifest.json';
const storeListingTxt = 'store-listing.txt';
const scssFiles = ['main.scss', 'help.scss', 'compose.scss'];
const tsFiles = ['options.ts', 'background.ts', 'content.ts'];
const filesToCopy = [
	['README.md', 'README.md'],
	['LICENSE', 'LICENSE'],
	[join('docs', 'LICENSE-THIRD-PARTY.md'), 'LICENSE-THIRD-PARTY.md'],
	[join(sourceFolder, manifestJson), manifestJson],
	[join(sourceFolder, 'options.html'), 'options.html'],
	[join(sourceFolder, localeFolder), localeFolder],
];

// Runtime vars
let extensionName = '';
let extensionVersion = '';

// Get extension name and version from package.json
const getExtensionDetails = async (): Promise<void> => {
	const packageObj = await fs.readJson(packageJson) as PackageJson;

	extensionName = packageObj.name;
	extensionVersion = packageObj.version.replace('.0', '');
};

// Create a build folder if it doesn't exist already, otherwise empty it
const cleanBuildFolder = async (): Promise<void> => {
	await fs.emptyDir(buildFolder);
	await Promise.all([fs.emptyDir(firefoxSubfolder), fs.emptyDir(chromiumSubfolder), fs.emptyDir(deliverablesFolder)]);
};

// Customize manifest for different extension variants so that warnings aren't shown on install:
// - For Chromium, remove "browser_specific_settings" section
// - For Chromium, remove the Firefox background script fallback
// - For Firefox, remove the Chromium service worker entry
const customizeManifests = async (): Promise<void> => {
	const chromiumBrowserSettingsResult = await replace({
		files: join(chromiumSubfolder, manifestJson),
		from: /\t{0,4}"browser_specific_settings": ?[\s\S]{0,128}\},\s/,
		to: '',
		countMatches: true,
		disableGlobs: true,
	});

	const chromiumBackgroundScriptsResult = await replace({
		files: join(chromiumSubfolder, manifestJson),
		from: /\t\t"scripts": ?\[[\s\S]*?\],\n/,
		to: '',
		countMatches: true,
		disableGlobs: true,
	});

	const firefoxServiceWorkerResult = await replace({
		files: join(firefoxSubfolder, manifestJson),
		from: /,\n\t\t"service_worker": ?"scripts\/background\.js"/,
		to: '',
		countMatches: true,
		disableGlobs: true,
	});

	if (!chromiumBrowserSettingsResult || chromiumBrowserSettingsResult.length !== 1 || !chromiumBrowserSettingsResult[0].hasChanged) {
		throw new Error(`Section "browser_specific_settings" could not be found in ${manifestJson}`);
	} else if (!chromiumBackgroundScriptsResult || chromiumBackgroundScriptsResult.length !== 1 || !chromiumBackgroundScriptsResult[0].hasChanged) {
		throw new Error(`Option "scripts" could not be found in ${manifestJson}`);
	} else if (!firefoxServiceWorkerResult || firefoxServiceWorkerResult.length !== 1 || !firefoxServiceWorkerResult[0].hasChanged) {
		throw new Error(`Option "service_worker" could not be found in ${manifestJson}`);
	}
};

// Duplicate Firefox build folder to make other build variants
const duplicateBuildFolder = async (): Promise<void> => {
	await fs.copy(firefoxSubfolder, chromiumSubfolder);
};

// Generate extension icons in multiple sizes
const generateIcons = async (): Promise<void> => {
	const outputImagesFolder = join(firefoxSubfolder, imagesFolder);

	await fs.ensureDir(outputImagesFolder);
	await Promise.all([128, 64, 48, 32, 16].map(size => {
		return sharp(join(sourceFolder, imagesFolder, iconFilename))
			.resize(size, size)
			.png({
				compressionLevel: 9,
				adaptiveFiltering: true,
				palette: true,
			})
			.toFile(join(outputImagesFolder, `${size}.png`));
	}));
};

// Compile SCSS to CSS
const compileScss = async (): Promise<void> => {
	await Promise.all(scssFiles.map(filename => {
		const css = compile(join(sourceFolder, stylesFolder, filename), {
			style: 'compressed',
			sourceMap: false,
		}).css;

		return fs.outputFile(join(firefoxSubfolder, stylesFolder, filename.replace('.scss', '.css')), css);
	}));
};

// Compile extension TypeScript entrypoints to the JS filenames referenced by the manifest
const compileTypescript = async (): Promise<void> => {
	const result = await Bun.build({
		entrypoints: tsFiles.map(filename => join(sourceFolder, scriptsFolder, filename)),
		outdir: join(firefoxSubfolder, scriptsFolder),
		target: 'browser',
		format: 'iife',
		naming: '[name].[ext]',
	});

	if (!result.success) {
		throw new Error(result.logs.map(log => log.message).join('\n'));
	}
};

// Copy source files to build folder
const copyFiles = async (): Promise<void> => {
	const copyTasks = filesToCopy.map(([source, destination]) => {
		return fs.copy(source, join(firefoxSubfolder, destination), {
			filter: file => {
				// Filter out store-listing.txt files because we will generate these later
				return !file.includes(storeListingTxt);
			},
		});
	});

	await Promise.all(copyTasks);
};

// Generate complete store listing descriptions from localized store-listing.txt files
const generateStoreListings = async (): Promise<void> => {
	const sourceLocaleFolder = join(sourceFolder, localeFolder);
	const localeCodes = fs.readdirSync(sourceLocaleFolder)
		.filter(filename => fs.statSync(join(sourceLocaleFolder, filename)).isDirectory());

	const writeTasks = localeCodes.flatMap(localeCode => {
		const text = fs.readFileSync(join(sourceLocaleFolder, localeCode, storeListingTxt)).toString();
		const textForOpera = text.replace(/(?:🔶|🔸)/g, '♦').replace(/🙂/g, ':)');

		return [
			fs.writeFile(join(deliverablesFolder, `store-listing-${localeCode}.txt`), text),
			fs.writeFile(join(deliverablesFolder, `store-listing-${localeCode}-opera.txt`), textForOpera),
		];
	});

	await Promise.all(writeTasks);
};

// Helper function to zip files and folders
const zip = async (
	inputFolder: string,
	globPattern: string,
	ignoreGlobPatterns: string[],
	outputFolder: string,
	filenameLabel: string,
): Promise<void> => {
	return new Promise((resolve, reject) => {
		const filename = `${extensionName}-${extensionVersion}-${filenameLabel}.zip`;
		const output = fs.createWriteStream(join(outputFolder, filename));
		const archive = archiver('zip', {
			zlib: { level: 9 },
		});

		// Fired once all archive data has been written
		output.on('close', () => resolve());
		archive.on('error', (error: Error) => reject(error));

		// Zip all files and place in root directory of zip, excluding certain files/folders
		archive.pipe(output);
		archive.glob(globPattern, { cwd: inputFolder, ignore: ignoreGlobPatterns }, { prefix: '' });

		// Finalize the archive. We still need to wait for streams to finish
		void archive.finalize();
	});
};

// Create zip file of the Chromium build folder
const zipChromiumBuildFolder = async (): Promise<void> => {
	await zip(chromiumSubfolder, '**', [], buildFolder, 'chromium');
};

// Create zip file of the Firefox build folder
const zipFirefoxBuildFolder = async (): Promise<void> => {
	await zip(firefoxSubfolder, '**', [], buildFolder, 'firefox');
};

// Create zip file of the project source code (required by Firefox web store)
const zipSourceCode = async (): Promise<void> => {
	await zip('', '**', ['node_modules/**', 'build/**'], deliverablesFolder, 'source-firefox');
};

const main = async (): Promise<void> => {
	// Items in this array are completed sequentially. Tasks on the same level are run concurrently to save time
	const taskList: BuildTask[][] = [
		[getExtensionDetails, cleanBuildFolder],
		[copyFiles, compileScss, compileTypescript, generateIcons, zipSourceCode, generateStoreListings],
		[duplicateBuildFolder],
		[customizeManifests],
		[zipFirefoxBuildFolder, zipChromiumBuildFolder],
	];

	const noBS = new NoBS(taskList);
	const startTime = performance.now();

	console.log('Starting build\n');

	try {
		await noBS.run();
		console.log(`\nFinished in ${((performance.now() - startTime) / 1000).toFixed(2)} seconds\n`);
	} catch (error) {
		console.error(`\nError: ${error}\n`);
		process.exitCode = 1;
	}
};

await main();
