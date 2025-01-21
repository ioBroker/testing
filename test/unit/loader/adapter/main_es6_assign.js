// This file is used to test the unit test harness

'use strict';

const utils = require('@iobroker/adapter-core');

class TestAdapter extends utils.Adapter {
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    constructor(options = {}) {
        /** @type {ioBroker.AdapterOptions} */
        const adapterOptions = options;
        Object.assign(adapterOptions, { name: 'test-adapter' });
        super(adapterOptions);
        // After the super call, overwrite the methods on the options object
        Object.assign(adapterOptions, {
            ready: this.onReady.bind(this),
            objectChange: this.onObjectChange.bind(this),
            stateChange: this.onStateChange.bind(this),
            // message: this.onMessage.bind(this),
            unload: this.onUnload.bind(this),
        });
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    onReady() {}

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        callback();
    }

    /**
     * Is called if a subscribed object changes
     * @param {string} id
     * @param {ioBroker.Object | null | undefined} obj
     */
    onObjectChange(id, obj) {}

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {}

    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.message" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    // 	if (typeof obj === "object" && obj.message) {
    // 		if (obj.command === "send") {
    // 			// e.g. send email or pushover or whatever
    // 			this.log.info("send command");

    // 			// Send response in callback if required
    // 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
    // 		}
    // 	}
    // }
}

if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    module.exports = options => new TestAdapter(options);
} else {
    // otherwise start the instance directly
    new TestAdapter();
}
