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
exports.testAdapter = testAdapter;
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const adapterTools_1 = require("../../lib/adapterTools");
const adapterSetup_1 = require("./lib/adapterSetup");
const controllerSetup_1 = require("./lib/controllerSetup");
const dbConnection_1 = require("./lib/dbConnection");
const harness_1 = require("./lib/harness");
const logger_1 = require("./lib/logger");
function testAdapter(adapterDir, options = {}) {
    const appName = (0, adapterTools_1.getAppName)(adapterDir);
    const adapterName = (0, adapterTools_1.getAdapterName)(adapterDir);
    const testDir = path.join(os.tmpdir(), `test-${appName}.${adapterName}`);
    /** This db connection is only used for the lifetime of a test and then re-created */
    let dbConnection;
    let harness;
    const controllerSetup = new controllerSetup_1.ControllerSetup(adapterDir, testDir);
    let objectsBackup;
    let statesBackup;
    let isInSuite = false;
    console.log();
    console.log(`Running tests in ${testDir}`);
    console.log();
    async function prepareTests() {
        // Installation may take a while - especially if rsa-compat needs to be installed
        const oneMinute = 60000;
        this.timeout(30 * oneMinute);
        if (await controllerSetup.isJsControllerRunning()) {
            throw new Error('JS-Controller is already running! Stop it for the first test run and try again!');
        }
        const adapterSetup = new adapterSetup_1.AdapterSetup(adapterDir, testDir);
        // Installation happens in two steps:
        // First we need to set up JS Controller, so the databases etc. can be created
        // First, we need to copy all files and execute a `npm install`
        await controllerSetup.prepareTestDir(options.controllerVersion);
        // Only then we can install the adapter, because some (including VIS) try to access
        // the databases if JS Controller is installed
        await adapterSetup.installAdapterInTestDir();
        const dbConnection = new dbConnection_1.DBConnection(appName, testDir, (0, logger_1.createLogger)(options.loglevel ?? 'debug'));
        await dbConnection.start();
        controllerSetup.setupSystemConfig(dbConnection);
        await controllerSetup.disableAdminInstances(dbConnection);
        await adapterSetup.deleteOldInstances(dbConnection);
        await adapterSetup.addAdapterInstance();
        await dbConnection.stop();
        // Create a copy of the databases that we can restore later
        ({ objects: objectsBackup, states: statesBackup } = await dbConnection.backup());
    }
    async function shutdownTests() {
        // Stopping the processes may take a while
        this.timeout(30000);
        // Stop the controller again
        await harness.stopController();
        harness.removeAllListeners();
    }
    async function resetDbAndStartHarness() {
        this.timeout(30000);
        dbConnection = new dbConnection_1.DBConnection(appName, testDir, (0, logger_1.createLogger)(options.loglevel ?? 'debug'));
        // Clean up before every single test
        await Promise.all([
            controllerSetup.clearDBDir(),
            controllerSetup.clearLogDir(),
            dbConnection.restore(objectsBackup, statesBackup),
        ]);
        // Create a new test harness
        await dbConnection.start();
        harness = new harness_1.TestHarness(adapterDir, testDir, dbConnection);
        // Enable the adapter and set its loglevel to the selected one
        await harness.changeAdapterConfig(adapterName, {
            common: {
                enabled: true,
                loglevel: options.loglevel ?? 'debug',
            },
        });
        // And enable the sendTo emulation
        await harness.enableSendTo();
    }
    describe(`Adapter integration tests`, () => {
        before(prepareTests);
        describe('Adapter startup', () => {
            beforeEach(resetDbAndStartHarness);
            afterEach(shutdownTests);
            it('The adapter starts', function () {
                this.timeout(60000);
                const allowedExitCodes = new Set(options.allowedExitCodes ?? []);
                // Adapters with these modes are allowed to "immediately" exit with code 0
                switch (harness.getAdapterExecutionMode()) {
                    case 'schedule':
                        allowedExitCodes.add(0);
                        break;
                    case 'once':
                        allowedExitCodes.add(0);
                        break;
                    // @ts-expect-error subscribe was deprecated
                    case 'subscribe':
                        allowedExitCodes.add(0);
                        break;
                }
                return new Promise((resolve, reject) => {
                    // Register a handler to check the alive state and exit codes
                    harness
                        .on('stateChange', async (id, state) => {
                        if (id === `system.adapter.${adapterName}.0.alive` && state && state.val === true) {
                            // Wait a bit so we can catch errors that do not happen immediately
                            await new Promise(resolve => setTimeout(resolve, options.waitBeforeStartupSuccess !== undefined
                                ? options.waitBeforeStartupSuccess
                                : 5000));
                            resolve(`The adapter started successfully.`);
                        }
                    })
                        .on('failed', code => {
                        if (!allowedExitCodes.has(code)) {
                            reject(new Error(`The adapter startup was interrupted unexpectedly with ${typeof code === 'number' ? 'code' : 'signal'} ${code}`));
                        }
                        else {
                            // This was a valid exit code
                            resolve(`The expected ${typeof code === 'number' ? 'exit code' : 'signal'} ${code} was received.`);
                        }
                    });
                    void harness.startAdapter();
                }).then(msg => console.log(msg));
            });
        });
        // Call the user's tests
        if (typeof options.defineAdditionalTests === 'function') {
            const originalIt = global.it;
            // Ensure no it() gets called outside of a suite()
            function assertSuite() {
                if (!isInSuite) {
                    throw new Error('In user-defined adapter tests, it() must NOT be called outside of a suite()');
                }
            }
            const patchedIt = new Proxy(originalIt, {
                apply(target, thisArg, args) {
                    assertSuite();
                    return target.apply(thisArg, args);
                },
                get(target, propKey) {
                    assertSuite();
                    return target[propKey];
                },
            });
            describe('User-defined tests', () => {
                // patch the global it() function so nobody can bypass the checks
                global.it = patchedIt;
                // a test suite is a special `describe`, which sets up and tears down the test environment before and after ALL tests
                const suiteBody = (fn) => {
                    isInSuite = true;
                    before(resetDbAndStartHarness);
                    fn(() => harness);
                    after(shutdownTests);
                    isInSuite = false;
                };
                const suite = ((name, fn) => {
                    describe(name, () => suiteBody(fn));
                });
                // Support .skip and .only
                suite.skip = (name, fn) => {
                    describe.skip(name, () => suiteBody(fn));
                };
                suite.only = (name, fn) => {
                    describe.only(name, () => suiteBody(fn));
                };
                const args = {
                    suite,
                    describe,
                    it: patchedIt,
                };
                options.defineAdditionalTests(args);
                global.it = originalIt;
            });
        }
    });
}
