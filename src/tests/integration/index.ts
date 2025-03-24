import * as os from 'node:os';
import * as path from 'node:path';
import { getAdapterName, getAppName } from '../../lib/adapterTools';
import { AdapterSetup } from './lib/adapterSetup';
import { ControllerSetup } from './lib/controllerSetup';
import { DBConnection } from './lib/dbConnection';
import { TestHarness } from './lib/harness';
import { createLogger } from './lib/logger';

export interface TestAdapterOptions {
    allowedExitCodes?: (number | string)[];
    /** The loglevel to use for DB and adapter related logs */
    loglevel?: ioBroker.LogLevel;
    /** How long to wait before the adapter startup is considered successful */
    waitBeforeStartupSuccess?: number;
    /**
     * Which JS-Controller version or dist-tag should be used for the tests. Default: dev
     * This should only be changed during active development.
     */
    controllerVersion?: string;
    /** Allows you to define additional tests */
    defineAdditionalTests?: (args: TestContext) => void;
}

export interface TestSuiteFn {
    (name: string, fn: (getHarness: () => TestHarness) => void): void;
}

export interface TestSuite extends TestSuiteFn {
    /** Only runs the tests inside this `suite` for the current file */
    only: TestSuiteFn;
    /** Skips running the tests inside this `suite` for the current file */
    skip: TestSuiteFn;
}

export interface TestContext {
    /**
     * Defines a test suite. At the start of each suite, the adapter will be started with a fresh environment.
     * To define tests in each suite, use describe and it as usual.
     *
     * Each suite has its own test harness, which can be retrieved using the function that is passed to the suite callback.
     */
    suite: TestSuite;

    describe: Mocha.SuiteFunction;
    it: Mocha.TestFunction;
}

export function testAdapter(adapterDir: string, options: TestAdapterOptions = {}): void {
    const appName = getAppName(adapterDir);
    const adapterName = getAdapterName(adapterDir);
    const testDir = path.join(os.tmpdir(), `test-${appName}.${adapterName}`);

    /** This db connection is only used for the lifetime of a test and then re-created */
    let dbConnection: DBConnection;
    let harness: TestHarness;
    const controllerSetup = new ControllerSetup(adapterDir, testDir);

    let objectsBackup: Buffer;
    let statesBackup: Buffer;

    let isInSuite = false;

    console.log();
    console.log(`Running tests in ${testDir}`);
    console.log();

    async function prepareTests(this: Mocha.Context): Promise<void> {
        // Installation may take a while - especially if rsa-compat needs to be installed
        const oneMinute = 60000;
        this.timeout(30 * oneMinute);

        if (await controllerSetup.isJsControllerRunning()) {
            throw new Error('JS-Controller is already running! Stop it for the first test run and try again!');
        }

        const adapterSetup = new AdapterSetup(adapterDir, testDir);

        // Installation happens in two steps:
        // First we need to set up JS Controller, so the databases etc. can be created

        // First, we need to copy all files and execute a `npm install`
        await controllerSetup.prepareTestDir(options.controllerVersion);
        // Only then we can install the adapter, because some (including VIS) try to access
        // the databases if JS Controller is installed
        await adapterSetup.installAdapterInTestDir();

        const dbConnection = new DBConnection(appName, testDir, createLogger(options.loglevel ?? 'debug'));
        await dbConnection.start();
        controllerSetup.setupSystemConfig(dbConnection);
        await controllerSetup.disableAdminInstances(dbConnection);

        await adapterSetup.deleteOldInstances(dbConnection);
        await adapterSetup.addAdapterInstance();
        await dbConnection.stop();

        // Create a copy of the databases that we can restore later
        ({ objects: objectsBackup, states: statesBackup } = await dbConnection.backup());
    }

    async function shutdownTests(this: Mocha.Context): Promise<void> {
        // Stopping the processes may take a while
        this.timeout(30000);
        // Stop the controller again
        await harness.stopController();

        harness.removeAllListeners();
    }

    async function resetDbAndStartHarness(this: Mocha.Context): Promise<void> {
        this.timeout(30000);

        dbConnection = new DBConnection(appName, testDir, createLogger(options.loglevel ?? 'debug'));

        // Clean up before every single test
        await Promise.all([
            controllerSetup.clearDBDir(),
            controllerSetup.clearLogDir(),
            dbConnection.restore(objectsBackup, statesBackup),
        ]);

        // Create a new test harness
        await dbConnection.start();
        harness = new TestHarness(adapterDir, testDir, dbConnection);

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

                return new Promise<string>((resolve, reject) => {
                    // Register a handler to check the alive state and exit codes
                    harness
                        .on('stateChange', async (id, state) => {
                            if (id === `system.adapter.${adapterName}.0.alive` && state && state.val === true) {
                                // Wait a bit so we can catch errors that do not happen immediately
                                await new Promise(resolve =>
                                    setTimeout(
                                        resolve,
                                        options.waitBeforeStartupSuccess !== undefined
                                            ? options.waitBeforeStartupSuccess
                                            : 5000,
                                    ),
                                );
                                resolve(`The adapter started successfully.`);
                            }
                        })
                        .on('failed', code => {
                            if (!allowedExitCodes.has(code)) {
                                reject(
                                    new Error(
                                        `The adapter startup was interrupted unexpectedly with ${
                                            typeof code === 'number' ? 'code' : 'signal'
                                        } ${code}`,
                                    ),
                                );
                            } else {
                                // This was a valid exit code
                                resolve(
                                    `The expected ${
                                        typeof code === 'number' ? 'exit code' : 'signal'
                                    } ${code} was received.`,
                                );
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
            function assertSuite(): void {
                if (!isInSuite) {
                    throw new Error('In user-defined adapter tests, it() must NOT be called outside of a suite()');
                }
            }
            const patchedIt = new Proxy(originalIt, {
                apply(target, thisArg, args) {
                    assertSuite();
                    return target.apply(thisArg, args as any);
                },
                get(target, propKey) {
                    assertSuite();
                    return (target as any)[propKey];
                },
            });

            describe('User-defined tests', () => {
                // patch the global it() function so nobody can bypass the checks
                global.it = patchedIt;

                // a test suite is a special `describe`, which sets up and tears down the test environment before and after ALL tests
                const suiteBody = (fn: (getHarness: () => TestHarness) => void): void => {
                    isInSuite = true;
                    before(resetDbAndStartHarness);

                    fn(() => harness);

                    after(shutdownTests);
                    isInSuite = false;
                };

                const suite = ((name: string, fn: (getHarness: () => TestHarness) => void): void => {
                    describe(name, () => suiteBody(fn));
                }) as TestSuite;

                // Support .skip and .only
                suite.skip = (name, fn) => {
                    describe.skip(name, () => suiteBody(fn));
                };

                suite.only = (name, fn) => {
                    describe.only(name, () => suiteBody(fn));
                };

                const args: TestContext = {
                    suite,
                    describe,
                    it: patchedIt,
                };

                options.defineAdditionalTests!(args);

                global.it = originalIt;
            });
        }
    });
}
