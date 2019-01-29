// wotan-disable no-unused-expression
// tslint:disable:no-unused-expression

import { expect } from "chai";
import Module from "module";
import * as path from "path";
import { MockAdapter } from "../mockAdapter";
import { mockAdapterCore } from "../mockAdapterCore";
import { MockDatabase } from "../mockDatabase";

function replaceJsLoader(loaderFunction: NodeExtensions[string]): NodeExtensions[string] {
	const originalJsLoader = require.extensions[".js"];
	// Explicitly declare module as any so TS won't complain about _compile
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

export async function executeAdapterMainFile(mainFileName: string) {
	// We cannot be sure that the adapter supports compact mode and exports something from the main module
	// Therefore we cannot work with the exported method.
	// However if the adapter supports compact mode, we need to trick it into thinking it was not required
	const originalJsLoader = replaceJsLoader((module: any, filename: string) => {
		if (path.normalize(filename) === path.normalize(mainFileName)) {
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

	// setup the mocks
	const database = new MockDatabase();
	let adapterMock: MockAdapter | undefined;
	const adapterCoreMock = mockAdapterCore(database, mock => adapterMock = mock);

	// Load the adapter with a replaced reference to adapter-core
	allMocks["@iobroker/adapter-core"] = createMockModule("@iobroker/adapter-core", adapterCoreMock);
	require(mainFileName);

	// Restore the js loader so we don't fuck up more things
	restoreJsLoader(originalJsLoader);

	// Assert some basic stuff
	expect(adapterMock).to.exist;
	expect(adapterMock!.readyHandler).to.exist;

	// Execute the ready method (synchronously or asynchronously)
	const readyResult = adapterMock!.readyHandler!() as undefined | Promise<void>;
	if (readyResult instanceof Promise) await readyResult;
}
