// wotan-disable async-function-assignability

import { adapterShouldSupportCompactMode, locateAdapterMainFile } from "../../lib/adapterTools";
import { startMockAdapter } from "../../lib/startMockAdapter";

/**
 * Tests the adapter startup in offline mode (with mocks, no JS-Controller)
 * This is meant to be executed in a mocha context.
 */
export function testAdapterStartupOffline(adapterDir: string) {

	const mainFilename = locateAdapterMainFile(adapterDir);
	const supportsCompactMode = adapterShouldSupportCompactMode(adapterDir);

	describe(`Test the adapter startup (in a mocked environment) => `, () => {

		it("The adapter starts in normal mode", async () => {
			const { adapterMock, databaseMock } = await startMockAdapter(mainFilename);
			// TODO: Test that the unload callback is called
		});

		if (supportsCompactMode) {
			it("The adapter starts in compact mode", async () => {
				const { adapterMock, databaseMock } = await startMockAdapter(mainFilename, true);
				// TODO: Test that the unload callback is called
			});
		}

	});
}
