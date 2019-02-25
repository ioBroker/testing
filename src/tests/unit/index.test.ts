// wotan-disable no-unused-expression
// tslint:disable:no-unused-expression

import { expect } from "chai";
import * as path from "path";
import { MockAdapter, MockDatabase } from "..";
import { loadModuleInHarness } from "./harness/loader";
import { mockAdapterCore } from "./mocks/mockAdapterCore";

function doTest(adapterMainFile: string) {
	// Setup the mocks
	const databaseMock = new MockDatabase();
	let adapterMock: MockAdapter | undefined;
	const adapterCoreMock = mockAdapterCore(databaseMock, {
		onAdapterCreated: mock => {
			adapterMock = mock;
		},
	});

	// Load the adapter file into the test harness
	loadModuleInHarness(adapterMainFile, {
		mockedModules: { "@iobroker/adapter-core": adapterCoreMock },
		fakeNotRequired: true,
	});

	// Assert some basic stuff
	if (adapterMock == undefined) throw new Error("The adapter was not initialized!");
	expect(adapterMock.readyHandler, "The adapter's ready method could not be found!").to.exist;
	expect(adapterMock.unloadHandler, "The adapter's unload method could not be found!").to.exist;
}

describe("The unit test harness correctly picks up the adapter's event handlers", () => {
	it("when the main file is written conventionally", () => {
		doTest(path.join(process.cwd(), "test/main.js"));
	});

	it("when the main file is written as a class with events", () => {
		doTest(path.join(process.cwd(), "test/main_es6_events.js"));
	});

	it("when the main file is written as a class which assigns to the options object", () => {
		doTest(path.join(process.cwd(), "test/main_es6_assign.js"));
	});
});
