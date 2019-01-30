// wotan-disable no-unused-expression
// tslint:disable:no-unused-expression

import { expect } from "chai";
import Module from "module";
import * as path from "path";
import { MockAdapter } from "./mocks/mockAdapter";
import { mockAdapterCore } from "./mocks/mockAdapterCore";
import { MockDatabase } from "./mocks/mockDatabase";

function replaceJsLoader(loaderFunction: NodeExtensions[string]): NodeExtensions[string] {
	const originalJsLoader = require.extensions[".js"];
	require.extensions[".js"] = loaderFunction;
	return originalJsLoader;
}

function restoreJsLoader(originalJsLoader: NodeExtensions[string]) {
	require.extensions[".js"] = originalJsLoader;
}

/**
 * Creates a module that is loaded instead of another one with the same name
 */
function createMockModule(id: string, mocks: Record<string, any>) {
	const ret = new Module(id);
	ret.exports = mocks;
	return ret;
}
const allMocks: Record<string, any> = {
	"@iobroker/adapter-core": undefined,
};

function fakeRequire(filename: string) {
	if (filename in allMocks) return allMocks[filename].exports;
	return require(filename);
}

/**
 * Starts an adapter by executing its main file in a controlled offline environment.
 * The JS-Controller is replaced by mocks for the adapter and Objects and States DB, so
 * no working installation is necessary.
 * This method may throw (or reject) if something goes wrong during the adapter startup.
 * It returns an instance of the mocked adapter class and the database, so you can perform further tests.
 *
 * @param adapterMainFile The main file of the adapter to start. Must be a full path.
 * @param compactMode Whether to start the adapter in compact mode or not
 */
export async function startMockAdapter(adapterMainFile: string, compactMode: boolean = false) {
	// If the adapter supports compact mode and should be executed in "normal" mode,
	// we need to trick it into thinking it was not required
	let originalJsLoader: NodeExtensions[string];
	if (!compactMode) {
		originalJsLoader = replaceJsLoader((module: any, filename: string) => {
			if (path.normalize(filename) === path.normalize(adapterMainFile)) {
				module.parent = null;
			}
			// We are fucking with NodeJS internals here, so the original proxyquire does not work.
			// Replace require with our own simple version of proxyquire
			module.require = fakeRequire;

			// Optionally, we can modify the code before executing it
			// const originalCompile = module._compile;
			// module._compile = function (code: string, filename: string) {
			// 	// Replace all requires with our own fake
			// 	code = code.replace(/require\(([^\)]+)\)/g, "global.fakeRequire($1)")

			// 	// Restore everything to not break the NodeJS internals
			// 	module._compile = originalCompile;
			// 	module._compile(code, filename);
			// }
			// Call the original loader
			originalJsLoader(module, filename);
		});
	}

	// setup the mocks
	const databaseMock = new MockDatabase();
	let adapterMock: MockAdapter | undefined;
	const adapterCoreMock = mockAdapterCore(databaseMock, mock => adapterMock = mock);

	// Load the adapter with a replaced reference to adapter-core
	allMocks["@iobroker/adapter-core"] = createMockModule("@iobroker/adapter-core", adapterCoreMock);
	const mainFileExport: unknown = require(adapterMainFile);

	if (!compactMode) {
		// Restore the js loader so we don't fuck up more things
		restoreJsLoader(originalJsLoader!);
	} else {
		// In compact mode, the main file must export a function
		if (typeof mainFileExport !== "function") throw new Error("The adapter's main file must export a function in compact mode!");
		// Call it to initialize the adapter
		mainFileExport();
	}

	// Assert some basic stuff
	if (adapterMock == undefined) throw new Error("The adapter was not initialized!");
	expect(adapterMock.readyHandler).to.exist;

	// Execute the ready method (synchronously or asynchronously)
	const readyResult = adapterMock.readyHandler!() as undefined | Promise<void>;
	if (readyResult instanceof Promise) await readyResult;

	// Return the mock instances so the tests can work with them
	return {
		databaseMock,
		adapterMock,
	};
}
