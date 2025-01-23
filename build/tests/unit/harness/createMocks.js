"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMocks = createMocks;
const mockAdapter_1 = require("../mocks/mockAdapter");
const mockDatabase_1 = require("../mocks/mockDatabase");
/**
 * Creates a new set of mocks, including a mock database and a mock adapter.
 * To test the startup of an adapter, use `startMockAdapter` instead.
 */
function createMocks(adapterOptions) {
    const databaseMock = new mockDatabase_1.MockDatabase();
    const adapterMock = mockAdapter_1.createAdapterMock.bind(undefined)(databaseMock, adapterOptions);
    return {
        database: databaseMock,
        adapter: adapterMock,
    };
}
