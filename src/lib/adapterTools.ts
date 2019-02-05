// Add debug logging for tests
import debugModule from "debug";
const debug = debugModule("testing:unit:adapterTools");

// tslint:disable:unified-signatures
import { pathExists } from "fs-extra";
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
export async function locateAdapterMainFile(adapterDir: string) {
	debug(`locating adapter main file in ${adapterDir}...`);
	const ioPackage = loadIoPackage(adapterDir);

	// First look for the file defined in io-package.json or use "main.js" as a fallback
	const mainFile = typeof ioPackage.common.main === "string"
		? ioPackage.common.main
		: "main.js";

	let ret = path.join(adapterDir, mainFile);
	debug(`  => trying ${ret}`);
	if (await pathExists(ret)) {
		debug(`  => found ${mainFile}`);
		return ret;
	}

	// If both don't exist, JS-Controller uses <adapter name>.js as another fallback
	ret = path.join(adapterDir, ioPackage.common.name + ".js");
	debug(`  => trying ${ret}`);
	if (await pathExists(ret)) {
		debug(`  => found ${mainFile}`);
		return ret;
	}

	throw new Error(`The adapter main file was not found in ${adapterDir}`);
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

/** Reads other ioBroker modules this adapter depends on from io-package.json */
export function getAdapterDependencies(adapterDir: string): string[] {
	const ioPackage = loadIoPackage(adapterDir);
	return ioPackage.common.dependencies || [];
}
