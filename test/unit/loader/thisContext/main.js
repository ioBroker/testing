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
		});
		this.on('ready', this.onReady);
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		this.testMethod();
	}

	testMethod() {
		return true;
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
