export { MockAdapter } from "./lib/mocks/mockAdapter";
import { MockDatabase } from "./lib/mocks/mockDatabase";
export { MockDatabase, createAsserts } from "./lib/mocks/mockDatabase";
export { startMockAdapter } from "./lib/startMockAdapter";
export { tests } from "./tests";
/**
 * Creates a new set of mocks, including a mock database and a mock adapter.
 * For actual adapter tests, you need to use `startMockAdapter` instead.
 */
export declare function createMocks(): {
    database: MockDatabase;
    adapter: import("./lib/mocks/mockAdapter").MockAdapter;
};
