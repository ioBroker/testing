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
    const adapterConstructor = function (nameOrOptions) {
        const createAdapterMockOptions = typeof nameOrOptions === "string" ? { name: nameOrOptions } : nameOrOptions;
        const ret = mockAdapter_1.createAdapterMock(database, createAdapterMockOptions);
        if (typeof options.onAdapterCreated === "function")
            options.onAdapterCreated(ret);
        return ret;
    };
    return {
        controllerDir,
        getConfig,
        Adapter: adapterConstructor,
        adapter: adapterConstructor,
    };
}
exports.mockAdapterCore = mockAdapterCore;
