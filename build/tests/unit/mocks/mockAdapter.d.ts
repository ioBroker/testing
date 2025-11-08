import type { MockDatabase } from './mockDatabase';
import { type MockLogger } from './mockLogger';
import { type Mock } from './tools';
export type MockAdapter = Mock<ioBroker.Adapter> & {
    readyHandler: ioBroker.ReadyHandler | undefined;
    objectChangeHandler: ioBroker.ObjectChangeHandler | undefined;
    stateChangeHandler: ioBroker.StateChangeHandler | undefined;
    messageHandler: ioBroker.MessageHandler | undefined;
    unloadHandler: ioBroker.UnloadHandler | undefined;
    log: MockLogger;
    resetMock(): void;
    resetMockHistory(): void;
    resetMockBehavior(): void;
};
/**
 * Creates an adapter mock that is connected to a given database mock
 */
export declare function createAdapterMock(this: MockAdapter | void, db: MockDatabase, options?: Partial<ioBroker.AdapterOptions>): MockAdapter;
