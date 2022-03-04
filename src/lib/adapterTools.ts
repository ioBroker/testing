// Add debug logging for tests
import { isArray, isObject } from "alcalzone-shared/typeguards";
import debugModule from "debug";
import { pathExists } from "fs-extra";
import * as path from "path";
const debug = debugModule("testing:unit:adapterTools");

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

export function getAdapterExecutionMode(
	adapterDir: string,
): ioBroker.AdapterCommon["mode"] {
	const ioPackage = loadIoPackage(adapterDir);
	return ioPackage.common.mode;
}

/**
 * Locates an adapter's main file
 * @param adapterDir The directory the adapter resides in
 */
export async function locateAdapterMainFile(
	adapterDir: string,
): Promise<string> {
	debug(`locating adapter main file in ${adapterDir}...`);
	const ioPackage = loadIoPackage(adapterDir);
	const npmPackage = loadNpmPackage(adapterDir);

	// First look for the file defined in io-package.json or package.json or use "main.js" as a fallback
	const mainFile =
		typeof ioPackage.common.main === "string"
			? ioPackage.common.main
			: typeof npmPackage.main === "string"
			? npmPackage.main
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
 * Loads the adapter's common configuration from `io-package.json`
 * @param adapterDir The directory the adapter resides in
 */
export function loadAdapterCommon(adapterDir: string): Record<string, any> {
	const ioPackage = loadIoPackage(adapterDir);
	return ioPackage.common || {};
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
export function getAdapterDependencies(
	adapterDir: string,
): Record<string, string> {
	const ioPackage = loadIoPackage(adapterDir);
	const ret: Record<string, string> = {};
	if (isArray(ioPackage.common.dependencies)) {
		for (const dep of ioPackage.common.dependencies) {
			if (typeof dep === "string") {
				ret[dep] = "latest";
			} else if (isObject(dep)) {
				const key = Object.keys(dep)[0];
				if (key)
					ret[key] = (dep as Record<string, string>)[key] || "latest";
			}
		}
	}
	return ret;
}
