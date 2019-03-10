import * as path from "path";
import { createAdapterMock, MockAdapter } from "./mockAdapter";
import { MockDatabase } from "./mockDatabase";

interface MockAdapterConstructor {
	new(nameOrOptions: string | ioBroker.AdapterOptions): MockAdapter;
	(nameOrOptions: string | ioBroker.AdapterOptions): MockAdapter;
}

export interface MockAdapterCoreOptions {
	onAdapterCreated?: (adapter: MockAdapter) => void;
	adapterDir?: string;
}

export function mockAdapterCore(database: MockDatabase, options: MockAdapterCoreOptions = {}) {

	/**
	 * The root directory of JS-Controller
	 * If this has to exist in the test, the user/tester has to take care of it!
	 */
	const controllerDir = path.join(options.adapterDir || "", "..", "iobroker.js-controller");

	/** Reads the configuration file of JS-Controller */
	function getConfig() {
		return {} as Record<string, any>;
	}

	// tslint:disable-next-line: variable-name
	const AdapterConstructor = function(this: MockAdapter | void, nameOrOptions: string | ioBroker.AdapterOptions) {
		// This needs to be a class with the correct `this` context or the ES6 tests won't work
		if (!(this instanceof AdapterConstructor)) return new AdapterConstructor(nameOrOptions);

		const createAdapterMockOptions = typeof nameOrOptions === "string" ? { name: nameOrOptions } : nameOrOptions;
		const ret = createAdapterMock(database, createAdapterMockOptions);
		if (typeof options.onAdapterCreated === "function") options.onAdapterCreated(ret);
		Object.assign(this, ret);
		return this;
	} as MockAdapterConstructor;

	return {
		controllerDir,
		getConfig,
		Adapter: AdapterConstructor,
		adapter: AdapterConstructor,
	};
}
