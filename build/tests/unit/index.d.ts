import { StartMockAdapterOptions } from "./harness/startMockAdapter";
export interface TestAdapterOptions {
    allowedExitCodes?: number[];
    additionalMockedModules?: StartMockAdapterOptions["additionalMockedModules"];
    /** Allows you to define additional tests */
    defineAdditionalTests?: () => void;
}
/**
 * Tests the adapter startup in offline mode (with mocks, no JS-Controller)
 * This is meant to be executed in a mocha context.
 */
export declare function testAdapterWithMocks(adapterDir: string, options?: TestAdapterOptions): void;
