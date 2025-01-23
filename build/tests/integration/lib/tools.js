"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestControllerDir = getTestControllerDir;
exports.getTestDataDir = getTestDataDir;
exports.getTestLogDir = getTestLogDir;
exports.getTestDBDir = getTestDBDir;
exports.getTestAdapterDir = getTestAdapterDir;
const path = __importStar(require("path"));
const adapterTools_1 = require("../../../lib/adapterTools");
/**
 * Locates the directory where JS-Controller is installed for integration tests
 *
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
function getTestControllerDir(appName, testDir) {
    return path.resolve(testDir, 'node_modules', `${appName}.js-controller`);
}
/**
 * Locates the directory where JS-Controller stores its data for integration tests
 *
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
function getTestDataDir(appName, testDir) {
    return path.resolve(testDir, `${appName}-data`);
}
/**
 * Locates the directory where JS-Controller stores its logs for integration tests
 *
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
function getTestLogDir(appName, testDir) {
    return path.resolve(testDir, 'log');
}
/**
 * Locates the directory where JS-Controller stores its sqlite db during integration tests
 *
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
function getTestDBDir(appName, testDir) {
    return path.resolve(getTestDataDir(appName, testDir), 'sqlite');
}
/**
 * Locates the directory where the adapter will be stored for integration tests
 *
 * @param adapterDir The root directory of the adapter
 * @param testDir The directory the integration tests are executed in
 */
function getTestAdapterDir(adapterDir, testDir) {
    const adapterName = (0, adapterTools_1.getAdapterFullName)(adapterDir);
    return path.resolve(testDir, 'node_modules', adapterName);
}
