"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockAdapter_1 = require("./tests/unit/mocks/mockAdapter");
const mockDatabase_1 = require("./tests/unit/mocks/mockDatabase");
var mockDatabase_2 = require("./tests/unit/mocks/mockDatabase");
exports.MockDatabase = mockDatabase_2.MockDatabase;
exports.createAsserts = mockDatabase_2.createAsserts;
var startMockAdapter_1 = require("./tests/unit/harness/startMockAdapter");
exports.startMockAdapter = startMockAdapter_1.startMockAdapter;
var tests_1 = require("./tests");
exports.tests = tests_1.tests;
/**
 * Creates a new set of mocks, including a mock database and a mock adapter.
 * For actual adapter tests, you need to use `startMockAdapter` instead.
 */
function createMocks() {
    const databaseMock = new mockDatabase_1.MockDatabase();
    const adapterMock = mockAdapter_1.createAdapterMock(databaseMock);
    return {
        database: databaseMock,
        adapter: adapterMock,
    };
}
exports.createMocks = createMocks;
