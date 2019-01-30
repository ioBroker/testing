import { MockAdapter } from "./mocks/mockAdapter";
import { MockDatabase } from "./mocks/mockDatabase";
/**
 * Starts an adapter by executing its main file in a controlled offline environment.
 * The JS-Controller is replaced by mocks for the adapter and Objects and States DB, so
 * no working installation is necessary.
 * This method may throw (or reject) if something goes wrong during the adapter startup.
 * It returns an instance of the mocked adapter class and the database, so you can perform further tests.
 *
 * @param adapterMainFile The main file of the adapter to start. Must be a full path.
 * @param compactMode Whether to start the adapter in compact mode or not
 */
export declare function startMockAdapter(adapterMainFile: string, compactMode?: boolean): Promise<{
    databaseMock: MockDatabase;
    adapterMock: MockAdapter;
}>;
