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
 * Monkey-Patches module code before executing it by wrapping it in an IIFE whose arguments are modified globals
 * @param code The code to monkey patch
 * @param globals A dictionary of globals and their properties to be replaced
 */
function monkeyPatchGlobals(code, globals) {
    const prefix = `"use strict";

function buildProxy(global, mocks) {
	return new Proxy(global, {
		get: (target, name) => {
			if (name in mocks) return mocks[name];
			return target[name];
		}
	});
}

((${Object.keys(globals).join(", ")}) => {`;
    const patchedArguments = Object.keys(globals)
        .map(glob => {
        const patchObj = globals[glob];
        const patches = Object.keys(patchObj).map(fn => `${fn}: ${patchObj[fn]}`);
        return `buildProxy(${glob}, {${patches.join(", ")}})`;
    });
    const postfix = `
})(${patchedArguments.join(", ")});`;
    return prefix + code + postfix;
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
function fakeRequire(baseDir, filename) {
    // Resolve relative paths relative to the require-ing module
    if (baseDir != undefined && filename.startsWith(".")) {
        filename = path.join(baseDir, filename);
    }
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
 */
function startMockAdapter(adapterMainFile, options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        // Make sure the main file is not already loaded into the require cache
        if (adapterMainFile in require.cache)
            delete require.cache[adapterMainFile];
        /** A test-safe replacement for process.exit */
        function fakeProcessExit(code = 0) {
            const err = new Error(`process.exit was called with code ${code}`);
            // @ts-ignore
            err.processExitCode = code;
            throw err;
        }
        // If the adapter supports compact mode and should be executed in "normal" mode,
        // we need to trick it into thinking it was not required
        let originalJsLoader;
        originalJsLoader = replaceJsLoader((module, filename) => {
            // We are messing with NodeJS internals here, so the original proxyquire does not work.
            // Replace require with our own simple version of proxyquire
            module.require = fakeRequire.bind(undefined, path.dirname(filename));
            if (path.normalize(filename) === path.normalize(adapterMainFile)) {
                if (!options.compact) {
                    console.log("setting module parent to null");
                    module.parent = null;
                }
                // We do not want the adapter to call process.exit on our tests.
                // Therefore edit the source code before executing it
                const originalCompile = module._compile;
                module._compile = (code, _filename) => {
                    code = monkeyPatchGlobals(code, {
                        process: { exit: fakeProcessExit },
                    });
                    // Restore everything to not break the NodeJS internals
                    module._compile = originalCompile;
                    module._compile(code, _filename);
                };
            }
            // Call the original loader
            originalJsLoader(module, filename);
        });
        // setup the mocks
        const databaseMock = new mockDatabase_1.MockDatabase();
        // If instance objects are defined, populate the database mock with them
        if (options.instanceObjects && options.instanceObjects.length) {
            databaseMock.publishObjects(...options.instanceObjects);
        }
        let adapterMock;
        const adapterCoreMock = mockAdapterCore_1.mockAdapterCore(databaseMock, {
            onAdapterCreated: mock => {
                adapterMock = mock;
                // If an adapter configuration was given, set it on the mock
                if (options.config)
                    mock.config = options.config;
            },
        });
        // Load the adapter with a replaced reference to adapter-core
        allMocks["@iobroker/adapter-core"] = createMockModule("@iobroker/adapter-core", adapterCoreMock);
        const mainFileExport = require(adapterMainFile);
        // Restore the js loader so we don't fuck up more things
        restoreJsLoader(originalJsLoader);
        if (options.compact) {
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
        let processExitCode;
        let terminateReason;
        try {
            const readyResult = adapterMock.readyHandler();
            if (readyResult instanceof Promise)
                yield readyResult;
        }
        catch (e) {
            if (e instanceof Error) {
                const anyError = e;
                if (typeof anyError.processExitCode === "number") {
                    processExitCode = anyError.processExitCode;
                }
                else if (typeof anyError.terminateReason === "string") {
                    terminateReason = anyError.terminateReason;
                }
                else {
                    // This error was not meant for us, pass it through
                    throw e;
                }
            }
        }
        // Return the mock instances so the tests can work with them
        return {
            databaseMock,
            adapterMock,
            processExitCode,
            terminateReason,
        };
    });
}
exports.startMockAdapter = startMockAdapter;
