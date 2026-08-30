/**
 * Type declarations for the NoBS task runner package.
 *
 * @module nobs
 */
declare module 'nobs' {
	/** Asynchronous build step executed by the NoBS task runner. */
	type Task = () => Promise<void>;

	/** Minimal declaration for the NoBS staged task runner used by the build script. */
	class NoBS {
		/**
		 * Creates a runner from sequential stages of parallel tasks.
		 *
		 * Tasks in the same nested array run together. Each stage waits for the previous one.
		 */
		constructor(taskList: Task[][]);

		/** Runs all configured task stages. */
		run(): Promise<void>;
	}

	export default NoBS;
}
