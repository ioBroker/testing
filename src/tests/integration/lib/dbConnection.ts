import debugModule from "debug";
import EventEmitter from "events";
import { readFile, readJSONSync, writeFile, writeJSONSync } from "fs-extra";
import * as path from "path";
import { getTestControllerDir, getTestDataDir } from "./tools";

const debug = debugModule("testing:integration:DBConnection");

export type ObjectsDB = Record<string, ioBroker.Object>;
export type StatesDB = Record<string, ioBroker.State>;

export interface DBConnection {
	on(event: "objectChange", handler: ioBroker.ObjectChangeHandler): this;
	on(event: "stateChange", handler: ioBroker.StateChangeHandler): this;
}

/** The DB connection capsules access to the states and objects DB */
export class DBConnection extends EventEmitter {
	/**
	 * @param appName The branded name of "iobroker"
	 * @param testDir The directory the integration tests are executed in
	 */
	public constructor(
		private appName: string,
		private testDir: string,
		private logger: ioBroker.Logger,
	) {
		super();
		this.testControllerDir = getTestControllerDir(this.appName, testDir);
		this.testDataDir = getTestDataDir(appName, testDir);
	}

	private testDataDir: string;
	private testControllerDir: string;

	// TODO: These could use some better type definitions
	private _objectsServer: any;
	private _statesServer: any;

	private _objectsClient: any;
	/** The underlying objects client instance that can be used to access the objects DB */
	public get objectsClient(): any {
		return this._objectsClient;
	}

	private _statesClient: any;
	/** The underlying states client instance that can be used to access the states DB */
	public get statesClient(): any {
		return this._statesClient;
	}

	public get objectsType(): "file" | "jsonl" {
		return this.getSystemConfig().objects.type;
	}
	public get objectsPath(): string {
		return path.join(
			this.testDataDir,
			this.objectsType === "file" ? "objects.json" : "objects.jsonl",
		);
	}

	public get statesType(): "file" | "jsonl" {
		return this.getSystemConfig().states.type;
	}
	public get statesPath(): string {
		return path.join(
			this.testDataDir,
			this.statesType === "file" ? "states.json" : "states.jsonl",
		);
	}

	public getSystemConfig(): any {
		const systemFilename = path.join(
			this.testDataDir,
			`${this.appName}.json`,
		);
		return readJSONSync(systemFilename);
	}

	public async backup(): Promise<{ objects: Buffer; states: Buffer }> {
		debug("Creating DB backup...");
		const wasRunning = this._isRunning;
		await this.stop();

		const objects = await readFile(this.objectsPath);
		const states = await readFile(this.statesPath);

		if (wasRunning) await this.start();

		return { objects, states };
	}

	public async restore(objects: Buffer, states: Buffer): Promise<void> {
		debug("Restoring DB backup...");
		const wasRunning = this._isRunning;
		await this.stop();

		await writeFile(this.objectsPath, objects);
		await writeFile(this.statesPath, states);

		if (wasRunning) await this.start();
	}

	public setSystemConfig(systemConfig: any): void {
		const systemFilename = path.join(
			this.testDataDir,
			`${this.appName}.json`,
		);
		writeJSONSync(systemFilename, systemConfig, { spaces: 2 });
	}

	private _isRunning = false;
	public get isRunning(): boolean {
		return this._isRunning;
	}

	public async start(): Promise<void> {
		if (this._isRunning) {
			debug(
				"At least one DB instance is already running, not starting again...",
			);
			return;
		}

		debug("starting DB instances...");
		await this.createObjectsDB();
		await this.createStatesDB();
		this._isRunning = true;
		debug("DB instances started");
	}

	public async stop(): Promise<void> {
		if (!this._isRunning) {
			debug("No DB instance is running, nothing to stop...");
			return;
		}
		debug("Stopping DB instances...");
		// Stop clients before servers
		await this._objectsClient?.destroy();
		await this._objectsServer?.destroy();
		await this._statesClient?.destroy();
		await this._statesServer?.destroy();

		this._objectsClient = null;
		this._objectsServer = null;
		this._statesClient = null;
		this._statesServer = null;

		this._isRunning = false;
		debug("DB instances stopped");
	}

	/** Creates the objects DB and sets up listeners for it */
	private async createObjectsDB(): Promise<void> {
		debug("creating objects DB");

		const objectsType = this.objectsType;
		debug(`  => objects DB type: ${objectsType}`);

		const settings = {
			connection: {
				type: objectsType,
				host: "127.0.0.1",
				port: 19001,
				user: "",
				pass: "",
				noFileCache: false,
				connectTimeout: 2000,
			},
			logger: this.logger,
		};

		const objectsDbPath = require.resolve(
			`@iobroker/db-objects-${objectsType}`,
			{
				paths: [
					path.join(this.testDir, "node_modules"),
					path.join(this.testControllerDir, "node_modules"),
				],
			},
		);
		debug(`  => objects DB lib found at ${objectsDbPath}`);
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { Server, Client } = require(objectsDbPath);

		// First create the server
		await new Promise<void>((resolve) => {
			this._objectsServer = new Server({
				...settings,
				connected: () => {
					resolve();
				},
			});
		});

		// Then the client
		await new Promise<void>((resolve) => {
			this._objectsClient = new Client({
				...settings,
				connected: () => {
					this._objectsClient.subscribe("*");
					resolve();
				},
				change: this.emit.bind(this, "objectChange"),
			});
		});

		debug("  => done!");
	}

	/** Creates the states DB and sets up listeners for it */
	private async createStatesDB(): Promise<void> {
		debug(`creating states DB`);

		const statesType = this.statesType;
		debug(`  => states DB type: ${statesType}`);

		const settings = {
			connection: {
				type: statesType,
				host: "127.0.0.1",
				port: 19000,
				options: {
					auth_pass: null,
					retry_max_delay: 15000,
				},
			},
			logger: this.logger,
		};

		const statesDbPath = require.resolve(
			`@iobroker/db-states-${statesType}`,
			{
				paths: [
					path.join(this.testDir, "node_modules"),
					path.join(this.testControllerDir, "node_modules"),
				],
			},
		);
		debug(`  => states DB lib found at ${statesDbPath}`);
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { Server, Client } = require(statesDbPath);

		// First create the server
		await new Promise<void>((resolve) => {
			this._statesServer = new Server({
				...settings,
				connected: () => {
					resolve();
				},
			});
		});

		// Then the client
		await new Promise<void>((resolve) => {
			this._statesClient = new Client({
				...settings,
				connected: () => {
					this._statesClient.subscribe("*");
					resolve();
				},
				change: this.emit.bind(this, "stateChange"),
			});
		});

		debug("  => done!");
	}

	public readonly getObject: ioBroker.Adapter["getForeignObjectAsync"] =
		async (id) => {
			if (!this._objectsClient) {
				throw new Error("Objects DB is not running");
			}
			return this._objectsClient.getObjectAsync(id);
		};

	public readonly setObject: ioBroker.Adapter["setForeignObjectAsync"] =
		async (...args) => {
			if (!this._objectsClient) {
				throw new Error("Objects DB is not running");
			}
			return this._objectsClient.setObjectAsync(...args);
		};

	public readonly delObject: ioBroker.Adapter["delForeignObjectAsync"] =
		async (...args) => {
			if (!this._objectsClient) {
				throw new Error("Objects DB is not running");
			}
			return this._objectsClient.delObjectAsync(...args);
		};

	public readonly getState: ioBroker.Adapter["getForeignStateAsync"] = async (
		id,
	) => {
		if (!this._statesClient) {
			throw new Error("States DB is not running");
		}
		return this._statesClient.getStateAsync(id);
	};

	public readonly setState: ioBroker.Adapter["setForeignStateAsync"] =
		(async (...args: any[]) => {
			if (!this._statesClient) {
				throw new Error("States DB is not running");
			}
			return this._statesClient.setStateAsync(...args);
		}) as any;

	public readonly delState: ioBroker.Adapter["delForeignStateAsync"] = async (
		...args
	) => {
		if (!this._statesClient) {
			throw new Error("States DB is not running");
		}
		return this._statesClient.delStateAsync(...args);
	};

	public subscribeMessage(id: string): void {
		if (!this._statesClient) {
			throw new Error("States DB is not running");
		}
		return this._statesClient.subscribeMessage(id);
	}

	public pushMessage(
		instanceId: string,
		msg: any,
		callback: (err: Error | null, id: any) => void,
	): void {
		if (!this._statesClient) {
			throw new Error("States DB is not running");
		}
		this._statesClient.pushMessage(instanceId, msg, callback);
	}

	public readonly getObjectViewAsync: ioBroker.Adapter["getObjectViewAsync"] =
		async (...args) => {
			if (!this._objectsClient) {
				throw new Error("Objects DB is not running");
			}
			return this._objectsClient.getObjectViewAsync(...args);
		};

	public async getStateIDs(pattern = "*"): Promise<string[]> {
		if (!this._statesClient) {
			throw new Error("States DB is not running");
		}
		return (
			this._statesClient.getKeysAsync?.(pattern) ||
			this._statesClient.getKeys?.(pattern)
		);
	}

	public async getObjectIDs(pattern = "*"): Promise<string[]> {
		if (!this._objectsClient) {
			throw new Error("Objects DB is not running");
		}
		return (
			this._objectsClient.getKeysAsync?.(pattern) ||
			this._objectsClient.getKeys?.(pattern)
		);
	}
}
