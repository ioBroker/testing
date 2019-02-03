"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
/**
 * Locates the directory where JS-Controller is installed for integration tests
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
function getControllerDir(appName, testDir) {
    return path.join(testDir, "node_modules", `${appName}.js-controller`);
}
exports.getControllerDir = getControllerDir;
/**
 * Locates the directory where JS-Controller stores its data for integration tests
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
function getDataDir(appName, testDir) {
    return path.join(testDir, `${appName}-data`);
}
exports.getDataDir = getDataDir;
