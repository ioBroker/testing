import { StartMockAdapterOptions } from "./harness/startMockAdapter";
import { MockAdapter } from "./mocks/mockAdapter";
import { MockDatabase } from "./mocks/mockDatabase";
export interface TestAdapterOptions {
    allowedExitCodes?: number[];
    additionalMockedModules?: StartMockAdapterOptions["additionalMockedModules"];
    /** Change the default test timeout of 15000ms for the startup tests */
    startTimeout?: number;
    /** Allows you to define additional tests */
    defineAdditionalTests?: () => void;
    /** Allows you to modifiy the behavior of predefined mocks in the predefined methods */
    defineMockBehavior?: (database: MockDatabase, adapter: MockAdapter) => void;
}
/**
 * Tests the adapter startup in offline mode (with mocks, no JS-Controller)
 * This is meant to be executed in a mocha context.
 */
export declare function testAdapterWithMocks(adapterDir: string, options?: TestAdapterOptions): void;
