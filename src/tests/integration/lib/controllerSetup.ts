import { emptyDir, ensureDir, pathExists, unlink, writeFile, writeJSON } from "fs-extra";
import { Socket } from "net";
import * as path from "path";
import { getAdapterFullName, getAdapterName, getAppName } from "../../../lib/adapterTools";
import { executeCommand } from "../../../lib/executeCommand";
import { getTestAdapterDir, getTestControllerDir, getTestDataDir, getTestDBDir, getTestLogDir } from "./tools";

// Add debug logging for tests
import debugModule from "debug";
import { DBConnection } from "./dbConnection";
const debug = debugModule("testing:integration:ControllerSetup");

export class ControllerSetup {

	constructor(
		private adapterDir: string,
		private testDir: string,
		private dbConnection: DBConnection,
	) {
		debug("Creating ControllerSetup...");

		this.adapterName = getAdapterName(this.adapterDir);
		this.appName = getAppName(this.adapterDir);
		this.testAdapterDir = getTestAdapterDir(this.adapterDir, this.testDir);
		this.testControllerDir = getTestControllerDir(this.appName, this.testDir);
		this.testDataDir = getTestDataDir(this.appName, this.testDir);

		debug(`  directories:`);
		debug(`    controller: ${this.testControllerDir}`);
		debug(`    adapter:    ${this.testAdapterDir}`);
		debug(`    data:       ${this.testDataDir}`);
		debug(`  appName:      ${this.appName}`);
		debug(`  adapterName:  ${this.adapterName}`);
	}

	private appName: string;
	private adapterName: string;
	private testAdapterDir: string;
	private testControllerDir: string;
	private testDataDir: string;

	public async prepareTestDir() {
		debug("Preparing the test directory...");
		// Make sure the test dir exists
		await ensureDir(this.testDir);

		// Write the package.json
		const packageJson = {
			name: path.basename(this.testDir),
			version: "1.0.0",
			main: "index.js",
			scripts: {
				test: "echo \"Error: no test specified\" && exit 1",
			},
			keywords: [],
			author: "",
			license: "ISC",
			dependencies: {
				[`${this.appName}.js-controller`]: `https://github.com/${this.appName}/${this.appName}.js-controller/tarball/master`,
			},
			description: "",
		};
		await writeJSON(path.join(this.testDir, "package.json"), packageJson, {spaces: 2});

		// Delete a possible npmrc (with package-lock disabled), so the installation can be faster
		const npmrcPath = path.join(this.testDir, ".npmrc");
		if (await pathExists(npmrcPath)) await unlink(npmrcPath);

		debug("  => done!");
	}

	/**
	 * Tests if JS-Controller is already installed
	 * @param appName The branded name of "iobroker"
	 * @param testDir The directory the integration tests are executed in
	 */
	public async isJsControllerInstalled() {
		debug("Testing if JS-Controller is installed...");
		// We expect js-controller to be installed if the dir in <testDir>/node_modules and the data directory exist
		const isInstalled = await pathExists(this.testControllerDir) && await pathExists(this.testDataDir);
		debug(`  => ${isInstalled}`);
		return isInstalled;
	}

	/**
	 * Tests if an instance of JS-Controller is already running by attempting to connect to the Objects DB
	 */
	public isJsControllerRunning() {
		debug("Testing if JS-Controller is running...");
		return new Promise<boolean>((resolve) => {
			const client = new Socket();
			// Try to connect to an existing ObjectsDB
			client.connect({
				port: 9000,
				host: "127.0.0.1",
			}).on("connect", () => {
				// The connection succeeded
				client.destroy();
				debug(`  => true`);
				resolve(true);
			}).on("error", () => {
				client.destroy();
				debug(`  => false`);
				resolve(false);
			});

			setTimeout(() => {
				// Assume the connection failed after 1 s
				client.destroy();
				debug(`  => false`);
				resolve(false);
			}, 1000);
		});
	}

	/**
	 * Installs a new instance of JS-Controller into the test directory
	 * @param appName The branded name of "iobroker"
	 * @param testDir The directory the integration tests are executed in
	 */
	public async installJsController() {
		debug("Installing newest JS-Controller from github...");
		// First npm install the JS-Controller into the correct directory
		const installUrl = `https://github.com/${this.appName}/${this.appName}.js-controller/tarball/master`;
		const installResult = await executeCommand("npm", ["i", installUrl, "--save"], {
			cwd: this.testDir,
		});
		if (installResult.exitCode !== 0) throw new Error("JS-Controller could not be installed!");
		debug("  => done!");
	}

	/**
	 * Sets up an existing JS-Controller instance for testing by executing "iobroker setup first"
	 * @param appName The branded name of "iobroker"
	 * @param testDir The directory the integration tests are executed in
	 */
	public async setupJsController() {
		debug("Initializing JS-Controller installation...");
		// Stop the controller before calling setup first
		await executeCommand("node", [`${this.appName}.js`, "stop"], {
			cwd: this.testControllerDir,
			stdout: "ignore",
		});

		const setupResult = await executeCommand("node", [`${this.appName}.js`, "setup", "first", "--console"], {
			cwd: this.testControllerDir,
			stdout: "ignore",
		});
		if (setupResult.exitCode !== 0) throw new Error(`${this.appName} setup first failed!`);
		debug("  => done!");
	}

	/**
	 * Changes the objects and states db to use alternative ports
	 * @param appName The branded name of "iobroker"
	 * @param testDir The directory the integration tests are executed in
	 */
	public async setupSystemConfig() {
		debug("Moving databases to different ports...");

		const systemFilename = path.join(this.testDataDir, `${this.appName}.json`);
		const systemConfig = require(systemFilename);
		systemConfig.objects.port = 19001;
		systemConfig.states.port = 19000;
		await writeFile(systemFilename, JSON.stringify(systemConfig, null, 2));
		debug("  => done!");
	}

	/**
	 * Clears the log dir for integration tests (and creates it if it doesn't exist)
	 * @param appName The branded name of "iobroker"
	 * @param testDir The directory the integration tests are executed in
	 */
	public clearLogDir() {
		debug("Cleaning log directory...");
		return emptyDir(getTestLogDir(this.appName, this.testDir));
	}

	/**
	 * Clears the sqlite DB dir for integration tests (and creates it if it doesn't exist)
	 * @param appName The branded name of "iobroker"
	 * @param testDir The directory the integration tests are executed in
	 */
	public clearDBDir() {
		debug("Cleaning SQLite directory...");
		return emptyDir(getTestDBDir(this.appName, this.testDir));
	}

	/**
	 * Disables all admin instances in the objects DB
	 * @param objects The contents of objects.json
	 */
	public async disableAdminInstances() {
		debug("Disabling admin instances...");
		const objects = await this.dbConnection.readObjectsDB();
		if (objects) {
			for (const id of Object.keys(objects)) {
				if (/^system\.adapter\.admin\.\d.+$/.test(id)) {
					const obj = objects[id] as any;
					if (obj && obj.common) obj.common.enabled = false;
				}
			}
			await this.dbConnection.writeObjectsDB(objects);
		}
		debug("  => done!");
	}

}
