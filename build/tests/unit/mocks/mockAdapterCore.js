"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockAdapter_1 = require("./mockAdapter");
function mockAdapterCore(database, options = {}) {
    /**
     * The root directory of JS-Controller
     * If this has to exist in the test, the user/tester has to take care of it!
     */
    const controllerDir = "../iobroker.js-controller";
    /** Reads the configuration file of JS-Controller */
    function getConfig() {
        return {};
    }
    // tslint:disable-next-line: variable-name
    const AdapterConstructor = function (nameOrOptions) {
        // This needs to be a class with the correct `this` context or the ES6 tests won't work
        if (!(this instanceof AdapterConstructor))
            return new AdapterConstructor(nameOrOptions);
        const createAdapterMockOptions = typeof nameOrOptions === "string" ? { name: nameOrOptions } : nameOrOptions;
        const ret = mockAdapter_1.createAdapterMock(database, createAdapterMockOptions);
        if (typeof options.onAdapterCreated === "function")
            options.onAdapterCreated(ret);
        Object.assign(this, ret);
        return this;
    };
    return {
        controllerDir,
        getConfig,
        Adapter: AdapterConstructor,
        adapter: AdapterConstructor,
    };
}
exports.mockAdapterCore = mockAdapterCore;
