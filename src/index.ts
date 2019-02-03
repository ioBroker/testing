import { createAdapterMock } from "./tests/unit/mocks/mockAdapter";
export { MockAdapter } from "./tests/unit/mocks/mockAdapter";

import { MockDatabase } from "./tests/unit/mocks/mockDatabase";
export { MockDatabase, createAsserts } from "./tests/unit/mocks/mockDatabase";

export { startMockAdapter } from "./tests/unit/harness/startMockAdapter";

export { tests } from "./tests";

/**
 * Creates a new set of mocks, including a mock database and a mock adapter.
 * For actual adapter tests, you need to use `startMockAdapter` instead.
 */
export function createMocks() {
	const databaseMock = new MockDatabase();
	const adapterMock = createAdapterMock(databaseMock);
	return {
		database: databaseMock,
		adapter: adapterMock,
	};
}
