"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const adapterStartup_1 = require("./offline/adapterStartup");
exports.tests = {
    offline: {
        adapterStartup: adapterStartup_1.testAdapterStartupOffline,
    },
};
