import * as path from "path";
import { getAppName } from "../../lib/adapterTools";

/**
 * Locates the directory where JS-Controller is installed for integration tests
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
export function getControllerDir(appName: string, testDir: string) {
	return path.join(testDir, "node_modules", `${appName}.js-controller`);
}

/**
 * Locates the directory where JS-Controller stores its data for integration tests
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
export function getDataDir(appName: string, testDir: string) {
	return path.join(testDir, `${appName}-data`);
}
