"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const integration_1 = require("./integration");
const packageFiles_1 = require("./packageFiles");
const adapterStartup_1 = require("./unit/adapterStartup");
var harness_1 = require("./integration/lib/harness");
exports.IntegrationTestHarness = harness_1.TestHarness;
exports.tests = {
    unit: {
        adapterStartup: adapterStartup_1.testAdapterStartupWithMocks,
    },
    integration: integration_1.testAdapter,
    packageFiles: packageFiles_1.validatePackageFiles,
};
