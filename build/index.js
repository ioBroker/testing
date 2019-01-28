"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockAdapter_1 = require("./mockAdapter");
const mockDatabase_1 = require("./mockDatabase");
var mockDatabase_2 = require("./mockDatabase");
exports.createAsserts = mockDatabase_2.createAsserts;
/** Creates a new set of mocks, including a mock database and a mock adapter */
function createMocks() {
    const databaseMock = new mockDatabase_1.MockDatabase();
    const adapterMock = mockAdapter_1.createAdapterMock(databaseMock);
    return {
        database: databaseMock,
        adapter: adapterMock,
    };
}
exports.createMocks = createMocks;
