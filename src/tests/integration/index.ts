import { wait } from "alcalzone-shared/async";
import * as os from "os";
import * as path from "path";
import { getAdapterName, getAppName } from "../../lib/adapterTools";
import { AdapterSetup } from "./lib/adapterSetup";
import { ControllerSetup } from "./lib/controllerSetup";
import { DBConnection } from "./lib/dbConnection";
import { TestHarness } from "./lib/harness";

export interface TestAdapterOptions {
	allowedExitCodes?: (number | string)[];
	/** How long to wait before the adapter startup is considered successful */
	waitBeforeStartupSuccess?: number;
	/** Allows you to define additional tests */
	defineAdditionalTests?: (getHarness: () => TestHarness) => void;
}

export function testAdapter(
	adapterDir: string,
	options: TestAdapterOptions = {},
): void {
	const appName = getAppName(adapterDir);
	const adapterName = getAdapterName(adapterDir);
	const testDir = path.join(os.tmpdir(), `test-${appName}.${adapterName}`);

	/** This db connection is only used for the lifetime of a test and then re-created */
	let dbConnection: DBConnection;
	let harness: TestHarness;
	const controllerSetup = new ControllerSetup(adapterDir, testDir);

	console.log();
	console.log(`Running tests in ${testDir}`);
	console.log();

	describe(`Test the adapter (in a live environment)`, () => {
		let objectsBackup: Buffer;
		let statesBackup: Buffer;

		before(async function () {
			// Installation may take a while - especially if rsa-compat needs to be installed
			const oneMinute = 60000;
			this.timeout(30 * oneMinute);

			if (await controllerSetup.isJsControllerRunning()) {
				throw new Error(
					"JS-Controller is already running! Stop it for the first test run and try again!",
				);
			}

			const adapterSetup = new AdapterSetup(adapterDir, testDir);

			// Installation happens in two steps:
			// First we need to set up JS Controller, so the databases etc. can be created

			// First we need to copy all files and execute an npm install
			await controllerSetup.prepareTestDir();
			// Only then we can install the adapter, because some (including VIS) try to access
			// the databases if JS Controller is installed
			await adapterSetup.installAdapterInTestDir();

			const dbConnection = new DBConnection(appName, testDir);
			await dbConnection.start();
			controllerSetup.setupSystemConfig(dbConnection);
			await controllerSetup.disableAdminInstances(dbConnection);

			await adapterSetup.deleteOldInstances(dbConnection);
			await adapterSetup.addAdapterInstance();
			await dbConnection.stop();

			// Create a copy of the databases that we can restore later
			({ objects: objectsBackup, states: statesBackup } =
				await dbConnection.backup());
		});

		beforeEach(async function () {
			this.timeout(30000);

			dbConnection = new DBConnection(appName, testDir);

			// Clean up before every single test
			await Promise.all([
				controllerSetup.clearDBDir(),
				controllerSetup.clearLogDir(),
				dbConnection.restore(objectsBackup, statesBackup),
			]);

			// Create a new test harness
			await dbConnection.start();
			harness = new TestHarness(adapterDir, testDir, dbConnection);

			// Enable the adapter and set its loglevel to debug
			await harness.changeAdapterConfig(adapterName, {
				common: {
					enabled: true,
					loglevel: "debug",
				},
			});

			// And enable the sendTo emulation
			await harness.enableSendTo();
		});

		afterEach(async function () {
			// Stopping the processes may take a while
			this.timeout(30000);
			// Stop the controller again
			await harness.stopController();

			harness.removeAllListeners();
		});

		it("The adapter starts", function () {
			this.timeout(60000);

			const allowedExitCodes = new Set(options.allowedExitCodes ?? []);

			// Schedule adapters are allowed to "immediately" exit with code 0
			if (harness.getAdapterExecutionMode() === "schedule") {
				allowedExitCodes.add(0);
			}

			return new Promise<string>((resolve, reject) => {
				// Register a handler to check the alive state and exit codes
				harness
					.on("stateChange", async (id, state) => {
						if (
							id === `system.adapter.${adapterName}.0.alive` &&
							state &&
							state.val === true
						) {
							// Wait a bit so we can catch errors that do not happen immediately
							await wait(
								options.waitBeforeStartupSuccess != undefined
									? options.waitBeforeStartupSuccess
									: 5000,
							);
							resolve(`The adapter started successfully.`);
						}
					})
					.on("failed", (code) => {
						if (!allowedExitCodes.has(code)) {
							reject(
								new Error(
									`The adapter startup was interrupted unexpectedly with ${
										typeof code === "number"
											? "code"
											: "signal"
									} ${code}`,
								),
							);
						} else {
							// This was a valid exit code
							resolve(
								`The expected ${
									typeof code === "number"
										? "exit code"
										: "signal"
								} ${code} was received.`,
							);
						}
					});
				harness.startAdapter();
			}).then((msg) => console.log(msg));
		});

		// Call the user's tests
		if (typeof options.defineAdditionalTests === "function") {
			options.defineAdditionalTests(() => harness);
		}
	});
}
