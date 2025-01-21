import { stub } from 'sinon';
import {
    doResetBehavior,
    doResetHistory,
    ImplementedMethodDictionary,
    Mock,
    stubAndPromisifyImplementedMethods,
} from './tools';

// The mocked objects interface has all the usual properties, but all methods are replaced with stubs
export type MockLogger = Mock<ioBroker.Logger> & {
    resetMock(): void;
    resetMockHistory(): void;
    resetMockBehavior(): void;
};

// Define here which methods were implemented manually, so we can hook them up with a real stub
// The value describes if and how the async version of the callback is constructed
const implementedMethods: ImplementedMethodDictionary<ioBroker.Logger> = {};

/**
 * Creates an adapter mock that is connected to a given database mock
 */
export function createLoggerMock(): MockLogger {
    const ret = {
        info: stub(),
        warn: stub(),
        error: stub(),
        debug: stub(),
        silly: stub(),
        level: 'info',

        // Mock-specific methods
        resetMockHistory() {
            // reset Logger
            doResetHistory(ret);
        },
        resetMockBehavior() {
            // reset Logger
            doResetBehavior(ret, implementedMethods);
        },
        resetMock() {
            ret.resetMockHistory();
            ret.resetMockBehavior();
        },
    } as MockLogger;

    stubAndPromisifyImplementedMethods(ret, implementedMethods);

    return ret;
}
