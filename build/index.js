"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockAdapter_1 = require("./mockAdapter");
var mockDatabase_1 = require("./mockDatabase");
exports.MockDatabase = mockDatabase_1.MockDatabase;
const mockDatabase_2 = require("./mockDatabase");
var mockDatabase_3 = require("./mockDatabase");
exports.createAsserts = mockDatabase_3.createAsserts;
/** Creates a new set of mocks, including a mock database and a mock adapter */
function createMocks() {
    const databaseMock = new mockDatabase_2.MockDatabase();
    const adapterMock = mockAdapter_1.createAdapterMock(databaseMock);
    return {
        database: databaseMock,
        adapter: adapterMock,
    };
}
exports.createMocks = createMocks;
