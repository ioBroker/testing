import { createAdapterMock, MockAdapter } from "./mockAdapter";
import { MockDatabase } from "./mockDatabase";

interface MockAdapterConstructor {
	new(nameOrOptions: string | ioBroker.AdapterOptions): MockAdapter;
	(nameOrOptions: string | ioBroker.AdapterOptions): MockAdapter;
}

export interface MockAdapterCoreOptions {
	onAdapterCreated?: (adapter: MockAdapter) => void;
}

export function mockAdapterCore(database: MockDatabase, options: MockAdapterCoreOptions = {}) {

	/**
	 * The root directory of JS-Controller
	 * If this has to exist in the test, the user/tester has to take care of it!
	 */
	const controllerDir = "../iobroker.js-controller";

	/** Reads the configuration file of JS-Controller */
	function getConfig() {
		return {} as Record<string, any>;
	}

	const adapterConstructor = function(this: MockAdapter | void, nameOrOptions: string | ioBroker.AdapterOptions) {
		const createAdapterMockOptions = typeof nameOrOptions === "string" ? { name: nameOrOptions } : nameOrOptions;
		const ret = createAdapterMock(database, createAdapterMockOptions);
		if (typeof options.onAdapterCreated === "function") options.onAdapterCreated(ret);
		return ret;
	} as MockAdapterConstructor;

	return {
		controllerDir,
		getConfig,
		Adapter: adapterConstructor,
		adapter: adapterConstructor,
	};
}
