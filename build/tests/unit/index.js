"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testAdapterWithMocks = testAdapterWithMocks;
/**
 * @deprecated
 * Tests the adapter startup in offline mode (with mocks, no JS-Controller)
 * This is meant to be executed in a mocha context.
 */
function testAdapterWithMocks(_adapterDir, options = {}) {
    describe(`Unit tests`, () => {
        // Call the user's tests
        if (typeof options.defineAdditionalTests === 'function') {
            options.defineAdditionalTests();
        }
        else {
            it('DEPRECATED!', () => {
                console.warn('\u001b[33mUnit tests for adapter startup are deprecated!');
                console.warn(`If you do not define your own tests, you can remove the "test:unit" script`);
                console.warn(`from package.json and from your Travis/Github Actions workflow.\u001b[0m`);
            });
        }
        return Promise.resolve();
    });
}
