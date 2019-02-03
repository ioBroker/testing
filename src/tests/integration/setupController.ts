import { pathExists, writeFile } from "fs-extra";
import { Socket } from "net";
import * as path from "path";
import { executeCommand } from "../../lib/executeCommand";
import { getControllerDir, getDataDir } from "./tools";

/**
 * Tests if JS-Controller is already installed
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
export async function isJsControllerInstalled(appName: string, testDir: string) {
	// We expect js-controller to be installed if the dir in <testDir>/node_modules and the data directory exist
	const controllerDir = getControllerDir(appName, testDir);
	const dataDir = getDataDir(appName, testDir);
	const isInstalled = await pathExists(controllerDir) && await pathExists(dataDir);
	return isInstalled;
}

/**
 * Tests if an instance of JS-Controller is already running by attempting to connect to the Objects DB
 */
export function isJsControllerRunning() {
	return new Promise<boolean>((resolve) => {
		const client = new Socket();
		// Try to connect to an existing ObjectsDB
		client.connect({
			port: 9000,
			host: "127.0.0.1",
		}).on("connect", () => {
			// The connection succeeded
			client.destroy();
			resolve(true);
		});

		setTimeout(() => {
			// Assume the connection failed after 1 s
			client.destroy();
			resolve(false);
		}, 1000);
	});
}

/**
 * Installs a new instance of JS-Controller into the test directory
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
export async function installJsController(appName: string, testDir: string) {
	// First npm install the JS-Controller into the correct directory
	const installUrl = `${appName}/${appName}.js-controller`; // github
	const installResult = await executeCommand("npm", ["i", installUrl], {
		cwd: testDir,
	});
	if (installResult.exitCode !== 0) throw new Error("JS-Controller could not be installed!");
}

/**
 * Sets up an existing JS-Controller instance for testing by executing "iobroker setup first"
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
export async function setupJsController(appName: string, testDir: string) {
	const controllerDir = getControllerDir(appName, testDir);
	// Stop the controller before calling setup first
	await executeCommand("node", [`${appName}.js`, "stop"], {
		cwd: controllerDir,
	});

	const setupResult = await executeCommand("node", [`${appName}.js`, "setup", "first", "--console"], {
		cwd: controllerDir,
	});
	if (setupResult.exitCode !== 0) throw new Error(`${appName} setup first failed!`);
}

/**
 * Changes the objects and states db to use alternative ports
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
export async function setupDatabases(appName: string, testDir: string) {
	const dataDir = getDataDir(appName, testDir);
	const systemFilename = path.join(dataDir, `${appName}.json`);
	const systemConfig = require(systemFilename);
	systemConfig.objects.port = 19001;
	systemConfig.states.port  = 19000;
	await writeFile(systemFilename, JSON.stringify(systemConfig, null, 2));
}
