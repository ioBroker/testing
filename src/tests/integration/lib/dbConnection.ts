import { pathExists, readJSON, writeJSON } from "fs-extra";
import * as path from "path";
import { getTestDataDir } from "./tools";

export type ObjectsDB = Record<string, ioBroker.Object>;
export type StatesDB = Record<string, ioBroker.State>;

/** The DB connection capsules access to the objects.json and states.json on disk */
export class DBConnection {
	/**
	 * @param appName The branded name of "iobroker"
	 * @param testDir The directory the integration tests are executed in
	 */
	public constructor(private appName: string, private testDir: string) {
		this.testDataDir = getTestDataDir(appName, testDir);
		this.objectsPath = path.join(this.testDataDir, "objects.json");
		this.statesPath = path.join(this.testDataDir, "states.json");
	}

	private testDataDir: string;
	private objectsPath: string;
	private statesPath: string;

	// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
	public async readObjectsDB() {
		// debug(`reading objects db...`);
		// debug(`  dataDir:     ${dataDir}`);
		// debug(`  objectsPath: ${objectsPath}`);

		if (await pathExists(this.objectsPath)) {
			// debug(`  exists:      true`);
			return (
				readJSON(this.objectsPath, { encoding: "utf8" }) as
				Promise<Record<string, ioBroker.Object>>
			);
		}
	}

	public async writeObjectsDB(objects: ObjectsDB | undefined): Promise<void> {
		if (!objects) return;
		return writeJSON(this.objectsPath, objects);
	}

	public async writeStatesDB(states: StatesDB | undefined): Promise<void> {
		if (!states) return;
		return writeJSON(this.statesPath, states);
	}

	public async readStatesDB(): Promise<any> {
		// debug(`reading states db...`);
		// debug(`  dataDir:     ${dataDir}`);
		// debug(`  statesPath:  ${statesPath}`);

		if (await pathExists(this.statesPath)) {
			// debug(`  exists:      true`);
			return readJSON(this.statesPath, { encoding: "utf8" });
		}
	}

	/**
	 * Creates a backup of the objects and states DB, so it can be restored after each test
	 * @param appName The branded name of "iobroker"
	 * @param testDir The directory the integration tests are executed in
	 */
	// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
	public async readDB() {
		const objects = await this.readObjectsDB();
		const states = await this.readStatesDB();

		return { objects, states };
	}

	/**
	 * Restores a previous backup of the objects and states DB
	 * @param appName The branded name of "iobroker"
	 * @param testDir The directory the integration tests are executed in
	 */
	public async writeDB(objects: any, states: any): Promise<void> {
		await this.writeObjectsDB(objects);
		await this.writeStatesDB(states);
	}
}
