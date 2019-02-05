import { MockDatabase } from "../mocks/mockDatabase";
/**
 * Creates a new set of mocks, including a mock database and a mock adapter.
 * To test the startup of an adapter, use `startMockAdapter` instead.
 */
export declare function createMocks(): {
    database: MockDatabase;
    adapter: import("../mocks/mockAdapter").MockAdapter;
};
