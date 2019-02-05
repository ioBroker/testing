// Add debug logging for tests
import debugModule from "debug";
const debug = debugModule("testing:integration:TestHarness");

import { wait } from "alcalzone-shared/async";
import { extend } from "alcalzone-shared/objects";
import { ChildProcess, spawn } from "child_process";
import { EventEmitter } from "events";
import { pathExists } from "fs-extra";
import * as path from "path";
import { getAdapterName, getAppName, locateAdapterMainFile } from "../../../lib/adapterTools";
import { DBConnection } from "./dbConnection";
import { getTestAdapterDir, getTestControllerDir } from "./tools";

const isWindows = /^win/.test(process.platform);

/** The logger instance for the objects and states DB */
const logger = {
	silly: console.log,
	debug: console.log,
	info: console.log,
	warn: console.warn,
	error: console.error,
};

// tslint:disable:unified-signatures
export interface TestHarness {
	on(event: "objectChange", handler: ioBroker.ObjectChangeHandler): this;
	on(event: "stateChange", handler: ioBroker.StateChangeHandler): this;
	on(event: "failed", handler: (codeOrSignal: number | string) => void): this;
}
// tslint:enable:unified-signatures

const fromAdapterID = "system.adapter.test.0";

/**
 * The test harness capsules the execution of the JS-Controller and the adapter instance and monitors their status.
 * Use it in every test to start a fresh adapter instance
 */
export class TestHarness extends EventEmitter {

	/**
	 * @param adapterDir The root directory of the adapter
	 * @param testDir The directory the integration tests are executed in
	 */
	constructor(
		private adapterDir: string,
		private testDir: string,
	) {
		super();

		debug("Creating instance");
		this.adapterName = getAdapterName(this.adapterDir);
		this.appName = getAppName(adapterDir);

		this.testControllerDir = getTestControllerDir(this.appName, testDir);
		this.testAdapterDir = getTestAdapterDir(this.adapterDir, testDir);

		debug(`  directories:`);
		debug(`    controller: ${this.testControllerDir}`);
		debug(`    adapter:    ${this.testAdapterDir}`);
		debug(`  appName:           ${this.appName}`);
		debug(`  adapterName:       ${this.adapterName}`);

		this.dbConnection = new DBConnection(this.appName, this.testDir);
	}

	private adapterName: string;
	private appName: string;
	private testControllerDir: string;
	private testAdapterDir: string;
	private dbConnection: DBConnection;

	private _objects: any;
	/** The actual objects DB */
	public get objects(): any {
		return this._objects;
	}
	private _states: any;
	/** The actual states DB */
	public get states(): any {
		return this._states;
	}

	private _adapterProcess: ChildProcess | undefined;
	/** The process the adapter is running in */
	public get adapterProcess(): ChildProcess | undefined {
		return this._adapterProcess;
	}

	private _adapterExit: number | string | undefined;
	/** Contains the adapter exit code or signal if it was terminated unexpectedly */
	public get adapterExit(): number | string | undefined {
		return this._adapterExit;
	}

	/** Creates the objects DB and sets up listeners for it */
	private async createObjectsDB() {
		debug("creating objects DB");

		// tslint:disable-next-line:variable-name
		const Objects = require(path.join(
			this.testControllerDir,
			"lib/objects/objectsInMemServer",
		));

		return new Promise<void>(resolve => {
			this._objects = new Objects({
				connection: {
					type: "file",
					host: "127.0.0.1",
					port: 19001,
					user: "",
					pass: "",
					noFileCache: false,
					connectTimeout: 2000,
				},
				logger,
				connected: () => {
					debug("  => done!");
					resolve();
				},
				change: this.emit.bind(this, "objectChange"),
			});
			this._objects.subscribe("*");
		});
	}

	/** Creates the states DB and sets up listeners for it */
	private async createStatesDB() {
		debug("creating states DB");

		// tslint:disable-next-line:variable-name
		const States = require(path.join(
			this.testControllerDir,
			"lib/states/statesInMemServer",
		));

		return new Promise<void>(resolve => {
			this._states = new States({
				connection: {
					type: "file",
					host: "127.0.0.1",
					port: 19000,
					options: {
						auth_pass: null,
						retry_max_delay: 15000,
					},
				},
				logger,
				connected: () => {
					debug("  => done!");
					resolve();
				},
				change: this.emit.bind(this, "stateChange"),
			});
			this._states.subscribe("*");
		});
	}

	/** Checks if the controller instance is running */
	public isControllerRunning() {
		return this._objects || this._states;
	}

	/** Starts the controller instance by creating the databases */
	public async startController() {
		debug("starting controller instance...");
		if (this.isControllerRunning()) throw new Error("The Controller is already running!");
		await this.createObjectsDB();
		await this.createStatesDB();
		debug("controller instance created");
	}

	/** Stops the controller instance (and the adapter if it is running) */
	public async stopController() {
		if (!this.isControllerRunning()) return;

		debug("Stopping controller instance...");
		if (this._objects) {
			// Set adapter instance disabled
			this._objects.setObject(`system.adapter.${this.adapterName}.0`, {
				common: {
					enabled: false,
				},
			});
		}

		// Give the adapter time to stop, but maximum 5s
		if (!this.didAdapterStop()) {
			debug("Stopping adapter instance...");
			await Promise.race([
				this.stopAdapter(),
				wait(5000),
			]);
			if (this.isAdapterRunning()) {
				debug("Adapter did not terminate, killing it");
				this._adapterProcess!.kill("SIGKILL");
			} else {
				debug("Adapter terminated");
			}
		} else {
			debug("Adapter failed to start - no need to terminate!");
		}

		if (this._objects) {
			this._objects.destroy();
			this._objects = null;
		}
		if (this._states) {
			this._states.destroy();
			this._states = null;
		}
		debug("Controller instance stopped");
	}

	/**
	 * Starts the adapter in a separate process and monitors its status
	 * @param env Additional environment variables to set
	 */
	public async startAdapter(env: NodeJS.ProcessEnv = {}) {
		if (this.isAdapterRunning()) throw new Error("The adapter is already running!");
		else if (this.didAdapterStop()) throw new Error("This test harness has already been used. Please create a new one for each test!");

		const mainFileAbsolute = await locateAdapterMainFile(this.testAdapterDir);
		const mainFileRelative = path.relative(this.testAdapterDir, mainFileAbsolute);

		const onClose = (code: number, signal: string) => {
			this._adapterProcess!.removeAllListeners();
			this._adapterExit = code != undefined ? code : signal;
			this.emit("failed", this._adapterExit);
		};

		this._adapterProcess =
			spawn(isWindows ? "node.exe" : "node", [mainFileRelative, "--console"], {
				cwd: this.testAdapterDir,
				stdio: ["inherit", "inherit", "inherit"],
				env: {...process.env, ...env},
			})
				.on("close", onClose)
				.on("exit", onClose)
			;
	}

	/**
	 * Starts the adapter in a separate process and resolves after it has started
	 * @param env Additional environment variables to set
	 */
	public async startAdapterAndWait(env: NodeJS.ProcessEnv = {}) {
		return new Promise<void>((resolve, reject) => {
			this
				.on("stateChange", async (id, state) => {
					if (id === `system.adapter.${this.adapterName}.0.alive` && state && state.val === true) {
						resolve();
					}
				})
				.on("failed", code => {
					reject(new Error(`The adapter startup was interrupted unexpectedly with ${typeof code === "number" ? "code" : "signal"} ${code}`));
				})
				.startAdapter(env)
				;
		});
	}

	/** Tests if the adapter process is still running */
	public isAdapterRunning(): boolean {
		return !!this._adapterProcess;
	}

	/** Tests if the adapter process has already exited */
	public didAdapterStop(): boolean {
		return this._adapterExit != undefined;
	}

	/** Stops the adapter process */
	public stopAdapter() {
		if (!this.isAdapterRunning()) return;

		return new Promise<void>(resolve => {
			const onClose = (code: number, signal: string) => {
				if (!this._adapterProcess) return;
				this._adapterProcess.removeAllListeners();

				this._adapterExit = code != undefined ? code : signal;
				this._adapterProcess = undefined;
				debug("Adapter process terminated:");
				debug(`  Code:   ${code}`);
				debug(`  Signal: ${signal}`);
				resolve();
			};

			this._adapterProcess!
				.removeAllListeners()
				.on("close", onClose)
				.on("exit", onClose)
				.kill("SIGTERM")
				;
		});
	}

	/**
	 * Updates the adapter config. The changes can be a subset of the target object
	 */
	public async changeAdapterConfig(appName: string, testDir: string, adapterName: string, changes: any) {
		const objects = await this.dbConnection.readObjectsDB();
		const adapterInstanceId = `system.adapter.${adapterName}.0`;
		if (objects && adapterInstanceId in objects) {
			const target = objects[adapterInstanceId];
			extend(target, changes);
			await this.dbConnection.writeObjectsDB(objects);
		}
	}

	/** Enables the sendTo method */
	public enableSendTo() {
		return new Promise<void>(resolve => {
			this._objects.setObject(fromAdapterID, {
				common: {},
				type: "instance",
			}, () => {
				this._states.subscribeMessage(fromAdapterID);
				resolve();
			});
		});
	}

	private sendToID: number = 1;

	/** Sends a message to an adapter instance */
	public sendTo(target: string, command: string, message: any, callback: ioBroker.MessageCallback) {
		const stateChangedHandler: ioBroker.StateChangeHandler = (id, state) => {
			if (id === `messagebox.${fromAdapterID}`) {
				callback((state as any).message);
				this.removeListener("stateChange", stateChangedHandler);
			}
		};
		this.addListener("stateChange", stateChangedHandler);

		this._states.pushMessage(`system.adapter.${target}`, {
			command: command,
			message: message,
			from: fromAdapterID,
			callback: {
				message: message,
				id: this.sendToID++,
				ack: false,
				time: Date.now(),
			},
		}, (err: any, id: any) => console.log("published message " + id));
	}
}
