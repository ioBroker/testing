export { MockAdapter } from "./tests/unit/mocks/mockAdapter";
import { MockDatabase } from "./tests/unit/mocks/mockDatabase";
export { MockDatabase, createAsserts } from "./tests/unit/mocks/mockDatabase";
export { startMockAdapter } from "./tests/unit/harness/startMockAdapter";
export { tests, IntegrationTestHarness } from "./tests";
/**
 * Creates a new set of mocks, including a mock database and a mock adapter.
 * For actual adapter tests, you need to use `startMockAdapter` instead.
 */
export declare function createMocks(): {
    database: MockDatabase;
    adapter: import("./tests/unit/mocks/mockAdapter").MockAdapter;
};
