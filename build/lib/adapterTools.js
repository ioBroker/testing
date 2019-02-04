"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:unified-signatures
const path = __importStar(require("path"));
/**
 * Loads an adapter's package.json
 * @param adapterDir The directory the adapter resides in
 */
function loadNpmPackage(adapterDir) {
    return require(path.join(adapterDir, "package.json"));
}
exports.loadNpmPackage = loadNpmPackage;
/**
 * Loads an adapter's io-package.json
 * @param adapterDir The directory the adapter resides in
 */
function loadIoPackage(adapterDir) {
    return require(path.join(adapterDir, "io-package.json"));
}
exports.loadIoPackage = loadIoPackage;
function adapterShouldSupportCompactMode(dirOrIoPack) {
    if (typeof dirOrIoPack === "string")
        dirOrIoPack = loadIoPackage(dirOrIoPack);
    return dirOrIoPack.common.compact === true;
}
exports.adapterShouldSupportCompactMode = adapterShouldSupportCompactMode;
/**
 * Locates an adapter's main file
 * @param adapterDir The directory the adapter resides in
 */
function locateAdapterMainFile(adapterDir) {
    const ioPackage = loadIoPackage(adapterDir);
    const mainFile = typeof ioPackage.common.main === "string"
        ? ioPackage.common.main
        : "main.js";
    return path.join(adapterDir, mainFile);
}
exports.locateAdapterMainFile = locateAdapterMainFile;
/**
 * Locates an adapter's config to populate the `adapter.config` object with
 * @param adapterDir The directory the adapter resides in
 */
function loadAdapterConfig(adapterDir) {
    const ioPackage = loadIoPackage(adapterDir);
    return ioPackage.native || {};
}
exports.loadAdapterConfig = loadAdapterConfig;
/**
 * Loads the instanceObjects for an adapter from its `io-package.json`
 * @param adapterDir The directory the adapter resides in
 */
function loadInstanceObjects(adapterDir) {
    const ioPackage = loadIoPackage(adapterDir);
    return ioPackage.instanceObjects || [];
}
exports.loadInstanceObjects = loadInstanceObjects;
/** Returns the branded name of "iobroker" */
function getAppName(adapterDir) {
    const npmPackage = loadNpmPackage(adapterDir);
    return npmPackage.name.split(".")[0] || "iobroker";
}
exports.getAppName = getAppName;
/** Returns the name of an adapter without the prefix */
function getAdapterName(adapterDir) {
    const ioPackage = loadIoPackage(adapterDir);
    return ioPackage.common.name;
}
exports.getAdapterName = getAdapterName;
/** Returns the full name of an adapter, including the prefix */
function getAdapterFullName(adapterDir) {
    const npmPackage = loadNpmPackage(adapterDir);
    return npmPackage.name;
}
exports.getAdapterFullName = getAdapterFullName;
