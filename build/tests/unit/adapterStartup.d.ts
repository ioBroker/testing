import { StartMockAdapterOptions } from "./harness/startMockAdapter";
export interface TestAdapterStartupOptions {
    allowedExitCodes?: number[];
    additionalMockedModules?: StartMockAdapterOptions["additionalMockedModules"];
}
/**
 * Tests the adapter startup in offline mode (with mocks, no JS-Controller)
 * This is meant to be executed in a mocha context.
 */
export declare function testAdapterStartupWithMocks(adapterDir: string, options?: TestAdapterStartupOptions): Promise<void>;
