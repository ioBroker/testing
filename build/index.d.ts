import { MockAdapter } from "./mockAdapter";
import { MockDatabase } from "./mockDatabase";
export { createAsserts } from "./mockDatabase";
/** Creates a new set of mocks, including a mock database and a mock adapter */
export declare function createMocks(): {
    database: MockDatabase;
    adapter: MockAdapter;
};
