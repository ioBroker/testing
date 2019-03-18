import { createAdapterMock } from "../mocks/mockAdapter";
import { MockDatabase } from "../mocks/mockDatabase";

/**
 * Creates a new set of mocks, including a mock database and a mock adapter.
 * To test the startup of an adapter, use `startMockAdapter` instead.
 */
export function createMocks(adapterOptions: Partial<ioBroker.AdapterOptions>) {
	const databaseMock = new MockDatabase();
	const adapterMock = createAdapterMock(databaseMock, adapterOptions);
	return {
		database: databaseMock,
		adapter: adapterMock,
	};
}
