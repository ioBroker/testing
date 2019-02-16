// wotan-disable async-function-assignability
// wotan-disable no-unused-expression

import { expect } from "chai";
import { adapterShouldSupportCompactMode, loadAdapterConfig, loadInstanceObjects, locateAdapterMainFile } from "../../lib/adapterTools";
import { startMockAdapter, StartMockAdapterOptions } from "./harness/startMockAdapter";
import { MockDatabase } from "./mocks/mockDatabase";
import { MockAdapter } from "./mocks/mockAdapter";

export interface TestAdapterOptions {
	allowedExitCodes?: number[];
	additionalMockedModules?: StartMockAdapterOptions["additionalMockedModules"];
	/** Allows you to define additional tests */
	defineAdditionalTests?: () => void;
	/** Allows you to modifiy the behavior of predefined mocks in the predefined methods */
	defineMockBehavior?: (database: MockDatabase, adapter: MockAdapter) => void;
}

/**
 * Tests the adapter startup in offline mode (with mocks, no JS-Controller)
 * This is meant to be executed in a mocha context.
 */
export function testAdapterWithMocks(adapterDir: string, options: TestAdapterOptions = {}) {

	function assertValidExitCode(allowedExitCodes: number[], exitCode?: number) {
		if (exitCode == undefined) return;
		// Ensure that a valid exit code was returned. By default, only 0 is allowed
		expect(allowedExitCodes).contains(exitCode,
			`process.exit was called with the unexpected exit code ${exitCode}!`,
		);
	}

	const adapterConfig = loadAdapterConfig(adapterDir);
	const instanceObjects = loadInstanceObjects(adapterDir);
	const supportsCompactMode = adapterShouldSupportCompactMode(adapterDir);

	describe(`Test the adapter (in a mocked environment)`, async () => {

		let mainFilename: string;

		before(async () => {
			mainFilename = await locateAdapterMainFile(adapterDir);
		});

		it("The adapter starts in normal mode", async () => {
			const { adapterMock, databaseMock, processExitCode, terminateReason } = await startMockAdapter(mainFilename, {
				config: adapterConfig,
				instanceObjects,
				additionalMockedModules: options.additionalMockedModules,
				defineMockBehavior: options.defineMockBehavior,
			});
			assertValidExitCode(options.allowedExitCodes || [0], processExitCode);
			// TODO: Test that the unload callback is called
		});

		if (supportsCompactMode) {
			it("The adapter starts in compact mode", async () => {
				const { adapterMock, databaseMock, processExitCode, terminateReason } = await startMockAdapter(mainFilename, {
					compact: true,
					config: adapterConfig,
					instanceObjects,
					additionalMockedModules: options.additionalMockedModules,
					defineMockBehavior: options.defineMockBehavior,
				});
				// In compact mode, only "adapter.terminate" may be called
				expect(processExitCode, "In compact mode, process.exit() must not be called!").to.be.undefined;
				// TODO: Test that the unload callback is called (if terminateReason is undefined)
			});
		}

		// Call the user's tests
		if (typeof options.defineAdditionalTests === "function") {
			options.defineAdditionalTests();
		}

	});
}
