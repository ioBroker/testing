// This file is used to test the unit test harness

'use strict';

const utils = require('@iobroker/adapter-core');

class TestAdapter extends utils.Adapter {

	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'test-adapter',
			ready: () => { },
		});

		// Ensure that the new mock methods work
		console.assert(typeof utils.getAbsoluteDefaultDataDir() === "string");
		console.assert(typeof utils.getAbsoluteInstanceDataDir(this) === "string");
	}

}

if (module.parent) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new TestAdapter(options);
} else {
	// otherwise start the instance directly
	new TestAdapter();
}
