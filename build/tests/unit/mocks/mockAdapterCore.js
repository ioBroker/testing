"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockAdapterCore = mockAdapterCore;
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const mockAdapter_1 = require("./mockAdapter");
function mockAdapterCore(database, options = {}) {
    /**
     * The root directory of JS-Controller
     * If this has to exist in the test, the user/tester has to take care of it!
     */
    const controllerDir = path.join(options.adapterDir || '', '..', 'iobroker.js-controller');
    const dataDir = path.join(os.tmpdir(), `test-iobroker-data`);
    /**
     * The test location for iobroker-data
     * If this has to exist in the test, the user/tester has to take care of it!
     */
    function getAbsoluteDefaultDataDir() {
        return dataDir;
    }
    /**
     * The test location for adapter-specific data
     * If this has to exist in the test, the user/tester has to take care of it!
     */
    function getAbsoluteInstanceDataDir(adapterObject) {
        return path.join(getAbsoluteDefaultDataDir(), adapterObject.namespace);
    }
    /** Reads the configuration file of JS-Controller */
    function getConfig() {
        return {};
    }
    const AdapterConstructor = function (nameOrOptions) {
        // This needs to be a class with the correct `this` context or the ES6 tests won't work
        if (!(this instanceof AdapterConstructor)) {
            return new AdapterConstructor(nameOrOptions);
        }
        const createAdapterMockOptions = typeof nameOrOptions === 'string' ? { name: nameOrOptions } : nameOrOptions;
        mockAdapter_1.createAdapterMock.bind(this)(database, createAdapterMockOptions);
        if (typeof options.onAdapterCreated === 'function') {
            options.onAdapterCreated(this);
        }
        return this;
    };
    return {
        controllerDir,
        getConfig,
        Adapter: AdapterConstructor,
        adapter: AdapterConstructor,
        getAbsoluteDefaultDataDir,
        getAbsoluteInstanceDataDir,
    };
}
