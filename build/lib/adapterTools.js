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
    const dirOrIoPack = loadIoPackage(adapterDir);
    const mainFile = typeof dirOrIoPack.common.main === "string"
        ? dirOrIoPack.common.main
        : "main.js";
    return path.join(adapterDir, mainFile);
}
exports.locateAdapterMainFile = locateAdapterMainFile;
