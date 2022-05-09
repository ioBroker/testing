/// <reference types="iobroker" />
/// <reference types="mocha" />
import { TestHarness } from "./lib/harness";
export interface TestAdapterOptions {
    allowedExitCodes?: (number | string)[];
    /** The loglevel to use for DB and adapter related logs */
    loglevel?: ioBroker.LogLevel;
    /** How long to wait before the adapter startup is considered successful */
    waitBeforeStartupSuccess?: number;
    /** Allows you to define additional tests */
    defineAdditionalTests?: (args: TestContext) => void;
}
export interface TestContext {
    /** Gives access to the current test harness */
    getHarness: () => TestHarness;
    /**
     * Defines a test suite. At the start of each suite, the adapter will be started with a fresh environment.
     * To define tests in each suite, use describe and it as usual.
     */
    suite: (name: string, fn: () => void) => void;
    describe: Mocha.SuiteFunction;
    it: Mocha.TestFunction;
}
export declare function testAdapter(adapterDir: string, options?: TestAdapterOptions): void;
