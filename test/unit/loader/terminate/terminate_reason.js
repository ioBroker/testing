'use strict';

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

/**
 * Starts the adapter instance
 * @param {Partial<ioBroker.AdapterOptions>} [options]
 */
function startAdapter(options) {
    // Create the adapter and define its methods
    const adapter = utils.adapter(
        Object.assign({}, options, {
            name: 'test-adapter',

            // The ready callback is called when databases are connected and adapter received configuration.
            // start here!
            ready: () => {
                adapter.terminate('reason');
            },

            // is called when adapter shuts down - callback has to be called under any circumstances!
            unload: callback => {
                callback();
            },

            // is called if a subscribed object changes
            objectChange: (id, obj) => {},

            // is called if a subscribed state changes
            stateChange: (id, state) => {},
        }),
    );
}

if (module.parent) {
    // Export startAdapter in compact mode
    module.exports = startAdapter;
} else {
    // otherwise start the instance directly
    startAdapter();
}
