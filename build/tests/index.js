"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.utils = exports.tests = void 0;
const integration_1 = require("./integration");
const packageFiles_1 = require("./packageFiles");
const unit_1 = require("./unit");
const createMocks_1 = require("./unit/harness/createMocks");
const startMockAdapter_1 = require("./unit/harness/startMockAdapter");
const mockDatabase_1 = require("./unit/mocks/mockDatabase");
var harness_1 = require("./integration/lib/harness");
Object.defineProperty(exports, "IntegrationTestHarness", { enumerable: true, get: function () { return harness_1.TestHarness; } });
var mockDatabase_2 = require("./unit/mocks/mockDatabase");
Object.defineProperty(exports, "MockDatabase", { enumerable: true, get: function () { return mockDatabase_2.MockDatabase; } });
/** Predefined test sets */
exports.tests = {
    unit: unit_1.testAdapterWithMocks,
    integration: integration_1.testAdapter,
    packageFiles: packageFiles_1.validatePackageFiles,
};
/** Utilities for your own tests */
exports.utils = {
    unit: {
        createMocks: createMocks_1.createMocks,
        createAsserts: mockDatabase_1.createAsserts,
        startMockAdapter: startMockAdapter_1.startMockAdapter,
    },
};
