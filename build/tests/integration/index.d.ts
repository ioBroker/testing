/// <reference types="iobroker" />
import { TestHarness } from "./lib/harness";
export interface TestAdapterOptions {
    allowedExitCodes?: (number | string)[];
    /** The loglevel to use for DB and adapter related logs */
    loglevel?: ioBroker.LogLevel;
    /** How long to wait before the adapter startup is considered successful */
    waitBeforeStartupSuccess?: number;
    /** Allows you to define additional tests */
    defineAdditionalTests?: (getHarness: () => TestHarness) => void;
}
export declare function testAdapter(adapterDir: string, options?: TestAdapterOptions): void;
