// Add debug logging for tests
import debugModule from "debug";
const debug = debugModule("testing:integration:AdapterSetup");

import { copy, pathExists, readJSON, remove, unlink, writeJSON } from "fs-extra";
import * as path from "path";
import { getAdapterDependencies, getAdapterFullName, getAdapterName, getAppName } from "../../../lib/adapterTools";
import { executeCommand } from "../../../lib/executeCommand";
import { DBConnection } from "./dbConnection";
import { getTestAdapterDir, getTestControllerDir } from "./tools";

export class AdapterSetup {

	constructor(
		private adapterDir: string,
		private testDir: string,
		private dbConnection: DBConnection,
	) {
		debug("Creating AdapterSetup...");

		this.adapterName = getAdapterName(this.adapterDir);
		this.adapterFullName = getAdapterFullName(this.adapterDir);
		this.appName = getAppName(this.adapterDir);
		this.testAdapterDir = getTestAdapterDir(this.adapterDir, this.testDir);
		this.testControllerDir = getTestControllerDir(this.appName, this.testDir);

		debug(`  directories:`);
		debug(`    controller: ${this.testControllerDir}`);
		debug(`    adapter:    ${this.testAdapterDir}`);
		debug(`  appName:           ${this.appName}`);
		debug(`  adapterName:       ${this.adapterName}`);
	}

	private testAdapterDir: string;
	private adapterName: string;
	private adapterFullName: string;
	private appName: string;
	private testControllerDir: string;

	/**
	 * Tests if the adapter is already installed in the test directory
	 */
	public async isAdapterInstalled() {
		// We expect the adapter to be installed if the dir in <testDir>/node_modules exists
		return pathExists(this.testAdapterDir);
	}

	/** Copies all adapter files (except a few) to the test directory */
	public async copyAdapterFilesToTestDir() {
		debug("Copying adapter files to test directory...");

		// We install the adapter almost like it would be installed in the real world
		// Therefore pack it into a tarball and put it in the test dir for installation
		const packResult = await executeCommand("npm", ["pack", "--loglevel", "silent"], {
			stdout: "pipe",
		});
		if (packResult.exitCode !== 0 || typeof packResult.stdout !== "string") throw new Error(`Packing the adapter tarball failed!`);

		const tarballName = packResult.stdout.trim();
		const tarballPath = path.resolve(this.adapterDir, tarballName);
		await copy(
			tarballPath,
			path.resolve(this.testDir, Date.now() + "-" + tarballName),
		);
		await unlink(tarballPath);

		// Complete the package.json, so npm can do it's magic
		debug("Saving the adapter in package.json");
		const packageJsonPath = path.join(this.testDir, "package.json");
		const packageJson = await readJSON(packageJsonPath);
		packageJson.dependencies[this.adapterFullName] = `file:./${tarballName}`;
		for (const dep of getAdapterDependencies(this.adapterDir)) {
			packageJson.dependencies[`${this.appName}.${dep}`] = "latest";
		}
		await writeJSON(packageJsonPath, packageJson, { spaces: 2 });

		debug("Deleting old remains of this adapter");
		if (await pathExists(this.testAdapterDir)) await remove(this.testAdapterDir);

		debug("  => done!");

	}

	/**
	 * Adds an instance for an already installed adapter in the test directory
	 */
	public async addAdapterInstance() {
		debug("Adding adapter instance...");

		// execute iobroker add <adapter> -- This also installs missing dependencies
		const addResult = await executeCommand("node", [`${this.appName}.js`, "add", this.adapterName, "--enabled", "false"], {
			cwd: this.testControllerDir,
			stdout: "ignore",
		});
		if (addResult.exitCode !== 0) throw new Error(`Adding the adapter instance failed!`);
		debug("  => done!");
	}

	public async deleteOldInstances() {
		debug("Removing old adapter instances...");

		const { objects, states } = await this.dbConnection.readDB();

		const instanceRegex = new RegExp(`^system\\.adapter\\.${this.adapterName}\\.\\d+`);
		const instanceObjsRegex = new RegExp(`^${this.adapterName}\\.\\d+\.`);

		const belongsToAdapter = (id: string) => {
			return instanceRegex.test(id)
				|| instanceObjsRegex.test(id)
				|| id === this.adapterName
				|| id === `${this.adapterName}.admin`
				;
		};

		if (objects) {
			for (const id of Object.keys(objects)) {
				if (belongsToAdapter(id)) delete objects[id];
			}
		}
		if (states) {
			for (const id of Object.keys(states)) {
				if (belongsToAdapter(id)) delete states[id];
			}
		}

		await this.dbConnection.writeDB(objects, states);
	}

}
