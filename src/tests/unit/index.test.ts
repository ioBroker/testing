import { expect } from "chai";
import * as path from "path";
import { MockAdapter, MockDatabase } from "..";
import { createMocks } from "./harness/createMocks";
import { loadModuleInHarness } from "./harness/loader";
import { startMockAdapter } from "./harness/startMockAdapter";
import { mockAdapterCore } from "./mocks/mockAdapterCore";

function loadAdapterMock(
	adapterMainFile: string,
): {
	adapterMock?: MockAdapter;
	mainFileExport: any;
} {
	// Setup the mocks
	const databaseMock = new MockDatabase();
	let adapterMock: MockAdapter | undefined;
	const adapterCoreMock = mockAdapterCore(databaseMock, {
		onAdapterCreated: (mock) => {
			adapterMock = mock;
		},
	});

	// Load the adapter file into the test harness
	const mainFileExport = loadModuleInHarness(adapterMainFile, {
		mockedModules: { "@iobroker/adapter-core": adapterCoreMock },
		fakeNotRequired: true,
	});

	return {
		adapterMock,
		mainFileExport,
	};
}

describe("The unit test harness correctly picks up the adapter's event handlers", () => {
	function assertAdapterAndHandlers(adapterMock: MockAdapter | undefined) {
		if (adapterMock == undefined)
			throw new Error("The adapter was not initialized!");
		expect(
			adapterMock.readyHandler,
			"The adapter's ready method could not be found!",
		).to.exist;
		expect(
			adapterMock.unloadHandler,
			"The adapter's unload method could not be found!",
		).to.exist;
	}

	it("when the main file is written conventionally", () => {
		const { adapterMock } = loadAdapterMock(
			path.join(process.cwd(), "test/unit/loader/adapter/main.js"),
		);
		assertAdapterAndHandlers(adapterMock);
	});

	it("when the main file is written as a class with events", () => {
		const { adapterMock } = loadAdapterMock(
			path.join(
				process.cwd(),
				"test/unit/loader/adapter/main_es6_events.js",
			),
		);
		assertAdapterAndHandlers(adapterMock);
	});

	it("when the main file is written as a class which assigns to the options object", () => {
		const { adapterMock } = loadAdapterMock(
			path.join(
				process.cwd(),
				"test/unit/loader/adapter/main_es6_assign.js",
			),
		);
		assertAdapterAndHandlers(adapterMock);
	});
});

describe("Regression tests", () => {
	it("The unit test harness correctly mocks modules that are loaded later", () => {
		const { mainFileExport } = loadAdapterMock(
			path.join(process.cwd(), "test/unit/loader/mocks/main.js"),
		);
		const testResult = mainFileExport();
		expect(testResult.main).to.equal(testResult.secondary);
	});

	it("The adapter methods should be executed in the correct `this` context", () => {
		const { adapterMock } = loadAdapterMock(
			path.join(process.cwd(), "test/unit/loader/thisContext/main.js"),
		);
		expect(() => adapterMock!.readyHandler!()).not.to.throw();
	});

	it("The mocked adapter.terminate() accepts strings and numbers", async () => {
		let {
			processExitCode,
			terminateReason,
		} = await startMockAdapter(
			path.join(
				process.cwd(),
				"test/unit/loader/terminate/terminate_code.js",
			),
			{ compact: true },
		);
		expect(terminateReason).to.be.a("string");
		expect(processExitCode).to.be.undefined;

		({
			processExitCode,
			terminateReason,
		} = await startMockAdapter(
			path.join(
				process.cwd(),
				"test/unit/loader/terminate/terminate_reason.js",
			),
			{ compact: true },
		));
		expect(terminateReason).to.be.a("string");
		expect(processExitCode).to.be.undefined;

		({
			processExitCode,
			terminateReason,
		} = await startMockAdapter(
			path.join(
				process.cwd(),
				"test/unit/loader/terminate/terminate_both.js",
			),
			{ compact: true },
		));
		expect(terminateReason).to.be.a("string");
		expect(processExitCode).to.be.undefined;
	});

	it("The mocked async methods don't stall", async () => {
		await startMockAdapter(
			path.join(process.cwd(), "test/unit/loader/asyncMocks/main.js"),
			{ compact: true },
		);
	});

	it("The mocked methods to access the data dir don't throw", async () => {
		await startMockAdapter(
			path.join(process.cwd(), "test/unit/loader/dataDir/main.js"),
		);

		await startMockAdapter(
			path.join(process.cwd(), "test/unit/loader/dataDir/main.js"),
			{ compact: true },
		);
	});

	it("The function createMocks() can be called multiple times", () => {
		expect(() => {
			createMocks({});
		}).not.to.throw();

		expect(() => {
			createMocks({});
		}).not.to.throw();
	});
});
