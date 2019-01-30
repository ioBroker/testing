"use strict";
// wotan-disable no-unused-expression
// tslint:disable:no-unused-expression
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const module_1 = __importDefault(require("module"));
const path = __importStar(require("path"));
const mockAdapterCore_1 = require("./mocks/mockAdapterCore");
const mockDatabase_1 = require("./mocks/mockDatabase");
function replaceJsLoader(loaderFunction) {
    const originalJsLoader = require.extensions[".js"];
    require.extensions[".js"] = loaderFunction;
    return originalJsLoader;
}
function restoreJsLoader(originalJsLoader) {
    require.extensions[".js"] = originalJsLoader;
}
/**
 * Creates a module that is loaded instead of another one with the same name
 */
function createMockModule(id, mocks) {
    const ret = new module_1.default(id);
    ret.exports = mocks;
    return ret;
}
const allMocks = {
    "@iobroker/adapter-core": undefined,
};
function fakeRequire(filename) {
    if (filename in allMocks)
        return allMocks[filename].exports;
    return require(filename);
}
/**
 * Starts an adapter by executing its main file in a controlled offline environment.
 * The JS-Controller is replaced by mocks for the adapter and Objects and States DB, so
 * no working installation is necessary.
 * This method may throw (or reject) if something goes wrong during the adapter startup.
 * It returns an instance of the mocked adapter class and the database, so you can perform further tests.
 *
 * @param adapterMainFile The main file of the adapter to start. Must be a full path.
 * @param compactMode Whether to start the adapter in compact mode or not
 */
function startMockAdapter(adapterMainFile, compactMode = false) {
    return __awaiter(this, void 0, void 0, function* () {
        // If the adapter supports compact mode and should be executed in "normal" mode,
        // we need to trick it into thinking it was not required
        let originalJsLoader;
        if (!compactMode) {
            originalJsLoader = replaceJsLoader((module, filename) => {
                if (path.normalize(filename) === path.normalize(adapterMainFile)) {
                    module.parent = null;
                }
                // We are fucking with NodeJS internals here, so the original proxyquire does not work.
                // Replace require with our own simple version of proxyquire
                module.require = fakeRequire;
                // Optionally, we can modify the code before executing it
                // const originalCompile = module._compile;
                // module._compile = function (code: string, filename: string) {
                // 	// Replace all requires with our own fake
                // 	code = code.replace(/require\(([^\)]+)\)/g, "global.fakeRequire($1)")
                // 	// Restore everything to not break the NodeJS internals
                // 	module._compile = originalCompile;
                // 	module._compile(code, filename);
                // }
                // Call the original loader
                originalJsLoader(module, filename);
            });
        }
        // setup the mocks
        const databaseMock = new mockDatabase_1.MockDatabase();
        let adapterMock;
        const adapterCoreMock = mockAdapterCore_1.mockAdapterCore(databaseMock, mock => adapterMock = mock);
        // Load the adapter with a replaced reference to adapter-core
        allMocks["@iobroker/adapter-core"] = createMockModule("@iobroker/adapter-core", adapterCoreMock);
        const mainFileExport = require(adapterMainFile);
        if (!compactMode) {
            // Restore the js loader so we don't fuck up more things
            restoreJsLoader(originalJsLoader);
        }
        else {
            // In compact mode, the main file must export a function
            if (typeof mainFileExport !== "function")
                throw new Error("The adapter's main file must export a function in compact mode!");
            // Call it to initialize the adapter
            mainFileExport();
        }
        // Assert some basic stuff
        if (adapterMock == undefined)
            throw new Error("The adapter was not initialized!");
        chai_1.expect(adapterMock.readyHandler).to.exist;
        // Execute the ready method (synchronously or asynchronously)
        const readyResult = adapterMock.readyHandler();
        if (readyResult instanceof Promise)
            yield readyResult;
        // Return the mock instances so the tests can work with them
        return {
            databaseMock,
            adapterMock,
        };
    });
}
exports.startMockAdapter = startMockAdapter;
