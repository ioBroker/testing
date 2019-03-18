// wotan-disable async-function-assignability
// wotan-disable no-unused-expression

import { expect } from "chai";
import { adapterShouldSupportCompactMode, loadAdapterCommon, loadAdapterConfig, loadInstanceObjects, locateAdapterMainFile } from "../../lib/adapterTools";
import { startMockAdapter, StartMockAdapterOptions, unloadMockAdapter } from "./harness/startMockAdapter";
import { MockAdapter } from "./mocks/mockAdapter";
import { MockDatabase } from "./mocks/mockDatabase";

export interface TestAdapterOptions {
	allowedExitCodes?: number[];
	additionalMockedModules?: StartMockAdapterOptions["additionalMockedModules"];
	/** Change the default test timeout of 15000ms for the startup tests */
	startTimeout?: number;
	/** Allows you to overwrite the default adapter config */
	overwriteAdapterConfig?: (config: Record<string, any>) => Record<string, any>;
	/** An array of objects that should be populated before starting the adapter */
	predefinedObjects?: ioBroker.Object[];
	/** A dictionary of states that should be populated before starting the adapter */
	predefinedStates?: Record<string, ioBroker.State>;
	/** Allows you to modifiy the behavior of predefined mocks in the predefined methods */
	defineMockBehavior?: (database: MockDatabase, adapter: MockAdapter) => void;
	/** Allows you to define additional tests */
	defineAdditionalTests?: () => void;
}

/**
 * Tests the adapter startup in offline mode (with mocks, no JS-Controller)
 * This is meant to be executed in a mocha context.
 */
export function testAdapterWithMocks(adapterDir: string, options: TestAdapterOptions = {}) {

	if (!options.startTimeout) {
		options.startTimeout = 15000;
	} else if (options.startTimeout < 1) {
		throw new Error("The start timeout must be a positive number!");
	}

	function assertValidExitCode(allowedExitCodes: number[], exitCode?: number) {
		if (exitCode == undefined) return;
		// Ensure that a valid exit code was returned. By default, only 0 is allowed
		expect(allowedExitCodes).contains(exitCode,
			`process.exit was called with the unexpected exit code ${exitCode}!`,
		);
	}

	const adapterCommon = loadAdapterCommon(adapterDir);
	const adapterConfig = loadAdapterConfig(adapterDir);
	const instanceObjects = loadInstanceObjects(adapterDir);
	const supportsCompactMode = adapterShouldSupportCompactMode(adapterDir);

	describe(`Test the adapter (in a mocked environment)`, async () => {

		let mainFilename: string;

		before(async () => {
			mainFilename = await locateAdapterMainFile(adapterDir);
		});

		it("The adapter starts in normal mode", async function() {
			// If necessary, change the default timeout
			if (typeof options.startTimeout === "number") this.timeout(options.startTimeout);
			// Give the user a chance to change the adapter config
			const actualAdapterConfig = typeof options.overwriteAdapterConfig === "function"
				? options.overwriteAdapterConfig({ ...adapterConfig }) : adapterConfig;

			const { adapterMock, databaseMock, processExitCode, terminateReason } = await startMockAdapter(mainFilename, {
				config: actualAdapterConfig,
				predefinedObjects: [
					...instanceObjects,
					...(options.predefinedObjects || []),
				],
				predefinedStates: options.predefinedStates,
				additionalMockedModules: options.additionalMockedModules,
				defineMockBehavior: options.defineMockBehavior,
				adapterDir,
			});
			assertValidExitCode(options.allowedExitCodes || [], processExitCode);
			// Test that the unload callback is called
			if (adapterMock && adapterMock.unloadHandler) {
				const unloadTestResult = await unloadMockAdapter(adapterMock, adapterCommon.stopTimeout);
				expect(unloadTestResult).to.be.true;
			}
		});

		if (supportsCompactMode) {
			it("The adapter starts in compact mode", async function() {
				// If necessary, change the default timeout
				if (typeof options.startTimeout === "number") this.timeout(options.startTimeout);
				// Give the user a chance to change the adapter config
				const actualAdapterConfig = typeof options.overwriteAdapterConfig === "function"
					? options.overwriteAdapterConfig({ ...adapterConfig }) : adapterConfig;

				const { adapterMock, databaseMock, processExitCode, terminateReason } = await startMockAdapter(mainFilename, {
					compact: true,
					config: actualAdapterConfig,
					predefinedObjects: [
						...instanceObjects,
						...(options.predefinedObjects || []),
					],
					predefinedStates: options.predefinedStates,
					additionalMockedModules: options.additionalMockedModules,
					defineMockBehavior: options.defineMockBehavior,
					adapterDir,
				});
				// In compact mode, only "adapter.terminate" may be called
				expect(processExitCode, "In compact mode, process.exit() must not be called!").to.be.undefined;
				// Test that the unload callback is called
				if (terminateReason != undefined && adapterMock && adapterMock.unloadHandler) {
					const unloadTestResult = await unloadMockAdapter(adapterMock, adapterCommon.stopTimeout);
					expect(unloadTestResult).to.be.true;
				}
			});
		}

		// Call the user's tests
		if (typeof options.defineAdditionalTests === "function") {
			options.defineAdditionalTests();
		}

	});
}
