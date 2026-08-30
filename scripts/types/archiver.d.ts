/**
 * Type declarations for the `archiver` package.
 *
 * @module archiver
 */
declare module 'archiver' {
	import type { Archiver } from 'archiver';

	/** Archive format used by this project's build script. */
	type Format = 'zip';

	/** Options passed to the zip archive factory. */
	type Options = {
		/** Compression settings forwarded to Node's zlib implementation. */
		zlib?: {
			/** Compression level from 0, no compression, through 9, maximum compression. */
			level?: number;
		};
	};

	/**
	 * Creates an archive stream for the requested format.
	 *
	 * This declaration covers the callable CommonJS entrypoint used by the build script.
	 */
	export default function archiver(format: Format, options?: Options): Archiver;
}
