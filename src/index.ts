import { createAdapterMock } from "./lib/mocks/mockAdapter";
export { MockAdapter } from "./lib/mocks/mockAdapter";

import { MockDatabase } from "./lib/mocks/mockDatabase";
export { MockDatabase, createAsserts } from "./lib/mocks/mockDatabase";

export { startMockAdapter } from "./lib/startMockAdapter";

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
