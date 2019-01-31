export interface TestAdapterStartupOptions {
    allowedExitCodes?: number[];
}
/**
 * Tests the adapter startup in offline mode (with mocks, no JS-Controller)
 * This is meant to be executed in a mocha context.
 */
export declare function testAdapterStartupOffline(adapterDir: string, options?: TestAdapterStartupOptions): void;
