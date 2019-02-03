"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_extra_1 = require("fs-extra");
const net_1 = require("net");
const path = __importStar(require("path"));
const executeCommand_1 = require("../../lib/executeCommand");
const tools_1 = require("./tools");
/**
 * Tests if JS-Controller is already installed
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
function isJsControllerInstalled(appName, testDir) {
    return __awaiter(this, void 0, void 0, function* () {
        // We expect js-controller to be installed if the dir in <testDir>/node_modules and the data directory exist
        const controllerDir = tools_1.getControllerDir(appName, testDir);
        const dataDir = tools_1.getDataDir(appName, testDir);
        const isInstalled = (yield fs_extra_1.pathExists(controllerDir)) && (yield fs_extra_1.pathExists(dataDir));
        return isInstalled;
    });
}
exports.isJsControllerInstalled = isJsControllerInstalled;
/**
 * Tests if an instance of JS-Controller is already running by attempting to connect to the Objects DB
 */
function isJsControllerRunning() {
    return new Promise((resolve) => {
        const client = new net_1.Socket();
        // Try to connect to an existing ObjectsDB
        client.connect({
            port: 9000,
            host: "127.0.0.1",
        }).on("connect", () => {
            // The connection succeeded
            client.destroy();
            resolve(true);
        });
        setTimeout(() => {
            // Assume the connection failed after 1 s
            client.destroy();
            resolve(false);
        }, 1000);
    });
}
exports.isJsControllerRunning = isJsControllerRunning;
/**
 * Installs a new instance of JS-Controller into the test directory
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
function installJsController(appName, testDir) {
    return __awaiter(this, void 0, void 0, function* () {
        // First npm install the JS-Controller into the correct directory
        const installUrl = `${appName}/${appName}.js-controller`; // github
        const installResult = yield executeCommand_1.executeCommand("npm", ["i", installUrl], {
            cwd: testDir,
        });
        if (installResult.exitCode !== 0)
            throw new Error("JS-Controller could not be installed!");
    });
}
exports.installJsController = installJsController;
/**
 * Sets up an existing JS-Controller instance for testing by executing "iobroker setup first"
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
function setupJsController(appName, testDir) {
    return __awaiter(this, void 0, void 0, function* () {
        const controllerDir = tools_1.getControllerDir(appName, testDir);
        // Stop the controller before calling setup first
        yield executeCommand_1.executeCommand("node", [`${appName}.js`, "stop"], {
            cwd: controllerDir,
        });
        const setupResult = yield executeCommand_1.executeCommand("node", [`${appName}.js`, "setup", "first", "--console"], {
            cwd: controllerDir,
        });
        if (setupResult.exitCode !== 0)
            throw new Error(`${appName} setup first failed!`);
    });
}
exports.setupJsController = setupJsController;
/**
 * Changes the objects and states db to use alternative ports
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
function setupDatabases(appName, testDir) {
    return __awaiter(this, void 0, void 0, function* () {
        const dataDir = tools_1.getDataDir(appName, testDir);
        const systemFilename = path.join(dataDir, `${appName}.json`);
        const systemConfig = require(systemFilename);
        systemConfig.objects.port = 19001;
        systemConfig.states.port = 19000;
        yield fs_extra_1.writeFile(systemFilename, JSON.stringify(systemConfig, null, 2));
    });
}
exports.setupDatabases = setupDatabases;
