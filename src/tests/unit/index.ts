export interface TestAdapterOptions {
    // allowedExitCodes?: number[];
    // additionalMockedModules?: StartMockAdapterOptions["additionalMockedModules"];
    // /** Change the default test timeout of 15000ms for the startup tests */
    // startTimeout?: number;
    // /** Allows you to overwrite the default adapter config */
    // overwriteAdapterConfig?: (
    // 	config: Record<string, any>,
    // ) => Record<string, any>;
    // /** An array of objects that should be populated before starting the adapter */
    // predefinedObjects?: ioBroker.Object[];
    // /** A dictionary of states that should be populated before starting the adapter */
    // predefinedStates?: Record<string, ioBroker.State>;
    // /** Allows you to modify the behavior of predefined mocks in the predefined methods */
    // defineMockBehavior?: (database: MockDatabase, adapter: MockAdapter) => void;
    /** Allows you to define additional tests */
    defineAdditionalTests?: () => void;
}

/**
 * @deprecated
 * Tests the adapter startup in offline mode (with mocks, no JS-Controller)
 * This is meant to be executed in a mocha context.
 */
export function testAdapterWithMocks(_adapterDir: string, options: TestAdapterOptions = {}): void {
    describe(`Unit tests`, async () => {
        // Call the user's tests
        if (typeof options.defineAdditionalTests === 'function') {
            options.defineAdditionalTests();
        } else {
            it('DEPRECATED!', () => {
                console.warn('\u001b[33mUnit tests for adapter startup are deprecated!');
                console.warn(`If you do not define your own tests, you can remove the "test:unit" script`);
                console.warn(`from package.json and from your Travis/Github Actions workflow.\u001b[0m`);
            });
        }
    });
}
