// tslint:disable:unified-signatures
import * as path from "path";

/**
 * Loads an adapter's io-package.json
 * @param adapterDir The directory the adapter resides in
 */
export function loadIoPackage(adapterDir: string): Record<string, any> {
	return require(path.join(adapterDir, "io-package.json"));
}

/**
 * Checks if an adapter claims that it supports compact mode
 * @param ioPackage The contents of io-package.json in object format
 */
export function adapterShouldSupportCompactMode(ioPackage: Record<string, any>): boolean;
/**
 * Checks if an adapter claims that it supports compact mode
 * @param adapterDir The directory the adapter resides in
 */
export function adapterShouldSupportCompactMode(adapterDir: string): boolean;
export function adapterShouldSupportCompactMode(dirOrIoPack: string | Record<string, any>) {
	if (typeof dirOrIoPack === "string") dirOrIoPack = loadIoPackage(dirOrIoPack);
	return dirOrIoPack.common.compact === true;
}

/**
 * Locates an adapter's main file
 * @param adapterDir The directory the adapter resides in
 */
export function locateAdapterMainFile(adapterDir: string): string {
	const dirOrIoPack = loadIoPackage(adapterDir);
	const mainFile = typeof dirOrIoPack.common.main === "string"
		? dirOrIoPack.common.main
		: "main.js";

	return path.join(adapterDir, mainFile);
}
