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
const mockAdapterCore_1 = require("../mockAdapterCore");
const mockDatabase_1 = require("../mockDatabase");
function replaceJsLoader(loaderFunction) {
    const originalJsLoader = require.extensions[".js"];
    // Explicitly declare module as any so TS won't complain about _compile
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
function executeAdapterMainFile(mainFileName) {
    return __awaiter(this, void 0, void 0, function* () {
        // We cannot be sure that the adapter supports compact mode and exports something from the main module
        // Therefore we cannot work with the exported method.
        // However if the adapter supports compact mode, we need to trick it into thinking it was not required
        const originalJsLoader = replaceJsLoader((module, filename) => {
            if (path.normalize(filename) === path.normalize(mainFileName)) {
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
        // setup the mocks
        const database = new mockDatabase_1.MockDatabase();
        let adapterMock;
        const adapterCoreMock = mockAdapterCore_1.mockAdapterCore(database, mock => adapterMock = mock);
        // Load the adapter with a replaced reference to adapter-core
        allMocks["@iobroker/adapter-core"] = createMockModule("@iobroker/adapter-core", adapterCoreMock);
        require(mainFileName);
        // Restore the js loader so we don't fuck up more things
        restoreJsLoader(originalJsLoader);
        // Assert some basic stuff
        chai_1.expect(adapterMock).to.exist;
        chai_1.expect(adapterMock.readyHandler).to.exist;
        // Execute the ready method (synchronously or asynchronously)
        const readyResult = adapterMock.readyHandler();
        if (readyResult instanceof Promise)
            yield readyResult;
    });
}
exports.executeAdapterMainFile = executeAdapterMainFile;
