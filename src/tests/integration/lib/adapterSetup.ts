import { copy, ensureDir, pathExists, readdir, readJSON, remove, writeJSON } from "fs-extra";
import * as path from "path";
import { getAdapterFullName, getAdapterName, getAppName } from "../../../lib/adapterTools";
import { executeCommand } from "../../../lib/executeCommand";
import { getTestAdapterDir, getTestControllerDir } from "./tools";

// Add debug logging for tests
import debugModule from "debug";
import { DBConnection } from "./dbConnection";
const debug = debugModule("testing:integration:AdapterSetup");

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
		// Make sure the target dir exists and is empty
		await remove(this.testAdapterDir);
		await ensureDir(this.testAdapterDir);

		// fs-extra doesn't allow copying a folder into itself, so we need to enum all files/directories to copy
		const filesToCopy = (await readdir(this.adapterDir))
			// filter out unwanted files
			.filter(file => {
				// Don't copy dotfiles
				if (/^\./.test(file)) return false;
				// Don't copy node_modules
				if (file === "node_modules") return false;
				// Don't copy the test directory
				if (path.resolve(this.adapterDir, file) === this.testDir) return false;
				// Copy everything else
				return true;
			});
		// And copy them one-by-one
		for (const file of filesToCopy) {
			await copy(
				path.resolve(this.adapterDir, file),
				path.resolve(this.testAdapterDir, file),
			);
		}

		debug("Saving the adapter in package.json");
		const packageJsonPath = path.join(this.testDir, "package.json");
		const packageJson = await readJSON(packageJsonPath);
		if (packageJson && packageJson.dependencies) {
			const relativeDir = path
				.relative(this.testDir, this.testAdapterDir)
				.replace("\\", "/")
				;
			packageJson.dependencies[this.adapterFullName] = `file:${relativeDir}`;
			await writeJSON(packageJsonPath, packageJson, { spaces: 2 });
			debug("  => done!");
		} else {
			debug("  => package.json or -dependencies undefined!");
		}

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
