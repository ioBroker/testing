import * as os from "os";
import * as path from "path";
import { createAdapterMock, MockAdapter } from "./mockAdapter";
import { MockDatabase } from "./mockDatabase";

interface MockAdapterConstructor {
	new (nameOrOptions: string | ioBroker.AdapterOptions): MockAdapter;
	(nameOrOptions: string | ioBroker.AdapterOptions): MockAdapter;
}

export interface MockAdapterCoreOptions {
	onAdapterCreated?: (adapter: MockAdapter) => void;
	adapterDir?: string;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function mockAdapterCore(
	database: MockDatabase,
	options: MockAdapterCoreOptions = {},
) {
	/**
	 * The root directory of JS-Controller
	 * If this has to exist in the test, the user/tester has to take care of it!
	 */
	const controllerDir = path.join(
		options.adapterDir || "",
		"..",
		"iobroker.js-controller",
	);

	const dataDir = path.join(os.tmpdir(), `test-iobroker-data`);
	/**
	 * The test location for iobroker-data
	 * If this has to exist in the test, the user/tester has to take care of it!
	 */
	function getAbsoluteDefaultDataDir(): string {
		return dataDir;
	}

	/**
	 * The test location for adapter-specific data
	 * If this has to exist in the test, the user/tester has to take care of it!
	 */
	function getAbsoluteInstanceDataDir(adapterObject: MockAdapter): string {
		return path.join(getAbsoluteDefaultDataDir(), adapterObject.namespace);
	}

	/** Reads the configuration file of JS-Controller */
	function getConfig(): Record<string, any> {
		return {};
	}

	const AdapterConstructor = function(
		this: MockAdapter | void,
		nameOrOptions: string | ioBroker.AdapterOptions,
	) {
		// This needs to be a class with the correct `this` context or the ES6 tests won't work
		if (!(this instanceof AdapterConstructor))
			return new AdapterConstructor(nameOrOptions);

		const createAdapterMockOptions =
			typeof nameOrOptions === "string"
				? { name: nameOrOptions }
				: nameOrOptions;
		createAdapterMock.bind(this)(database, createAdapterMockOptions);
		if (typeof options.onAdapterCreated === "function")
			options.onAdapterCreated(this);
		return this;
	} as MockAdapterConstructor;

	return {
		controllerDir,
		getConfig,
		Adapter: AdapterConstructor,
		adapter: AdapterConstructor,
		getAbsoluteDefaultDataDir,
		getAbsoluteInstanceDataDir,
	};
}
