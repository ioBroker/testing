import { TestHarness } from "./lib/harness";
export interface TestAdapterOptions {
    allowedExitCodes?: (number | string)[];
    waitBeforeStartupSuccess?: number;
    /** Allows you to define additional tests */
    defineAdditionalTests?: (getHarness: () => TestHarness) => void;
}
export declare function testAdapter(adapterDir: string, options?: TestAdapterOptions): void;
