"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const packageFiles_1 = require("./packageFiles");
const adapterStartup_1 = require("./unit/adapterStartup");
exports.tests = {
    unit: {
        adapterStartup: adapterStartup_1.testAdapterStartupWithMocks,
    },
    packageFiles: packageFiles_1.validatePackageFiles,
};
