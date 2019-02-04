// tslint:disable:unified-signatures
import * as path from "path";

/**
 * Loads an adapter's package.json
 * @param adapterDir The directory the adapter resides in
 */
export function loadNpmPackage(adapterDir: string): Record<string, any> {
	return require(path.join(adapterDir, "package.json"));
}

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
	const ioPackage = loadIoPackage(adapterDir);
	const mainFile = typeof ioPackage.common.main === "string"
		? ioPackage.common.main
		: "main.js";

	return path.join(adapterDir, mainFile);
}

/**
 * Locates an adapter's config to populate the `adapter.config` object with
 * @param adapterDir The directory the adapter resides in
 */
export function loadAdapterConfig(adapterDir: string): Record<string, any> {
	const ioPackage = loadIoPackage(adapterDir);
	return ioPackage.native || {};
}

/**
 * Loads the instanceObjects for an adapter from its `io-package.json`
 * @param adapterDir The directory the adapter resides in
 */
export function loadInstanceObjects(adapterDir: string): ioBroker.Object[] {
	const ioPackage = loadIoPackage(adapterDir);
	return ioPackage.instanceObjects || [];
}

/** Returns the branded name of "iobroker" */
export function getAppName(adapterDir: string): string {
	const npmPackage = loadNpmPackage(adapterDir);
	return npmPackage.name.split(".")[0] || "iobroker";
}

/** Returns the name of an adapter without the prefix */
export function getAdapterName(adapterDir: string): string {
	const ioPackage = loadIoPackage(adapterDir);
	return ioPackage.common.name;
}

/** Returns the full name of an adapter, including the prefix */
export function getAdapterFullName(adapterDir: string): string {
	const npmPackage = loadNpmPackage(adapterDir);
	return npmPackage.name;
}
