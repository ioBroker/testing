import { MockAdapter, createAdapterMock } from "./mockAdapter";
import { MockDatabase } from "./mockDatabase";
export { createAsserts } from "./mockDatabase";

/** Creates a new set of mocks, including a mock database and a mock adapter */
export function createMocks() {
	const databaseMock = new MockDatabase();
	const adapterMock = createAdapterMock(databaseMock);
	return {
		database: databaseMock,
		adapter: adapterMock,
	};
}
