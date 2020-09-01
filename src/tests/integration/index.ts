import { wait } from "alcalzone-shared/async";
import * as os from "os";
import * as path from "path";
import { getAdapterName, getAppName } from "../../lib/adapterTools";
import { executeCommand } from "../../lib/executeCommand";
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

	let harness: TestHarness;
	const dbConnection = new DBConnection(appName, testDir);
	const controllerSetup = new ControllerSetup(
		adapterDir,
		testDir,
		dbConnection,
	);

	console.log();
	console.log(`Running tests in ${testDir}`);
	console.log();

	describe(`Test the adapter (in a live environment)`, () => {
		let objectsBackup: any;
		let statesBackup: any;

		before(async function () {
			// Installation may take a while - especially if rsa-compat needs to be installed
			const oneMinute = 60000;
			this.timeout(30 * oneMinute);

			if (await controllerSetup.isJsControllerRunning()) {
				throw new Error(
					"JS-Controller is already running! Stop it for the first test run and try again!",
				);
			}

			const adapterSetup = new AdapterSetup(
				adapterDir,
				testDir,
				dbConnection,
			);

			// First we need to copy all files and execute an npm install
			await controllerSetup.prepareTestDir();
			await adapterSetup.copyAdapterFilesToTestDir();

			// Remember if JS-Controller is installed already. If so, we need to call setup first later
			const wasJsControllerInstalled = await controllerSetup.isJsControllerInstalled();

			// Call npm install
			await executeCommand("npm", ["i", "--production"], {
				cwd: testDir,
			});

			// Prepare/clean the databases and config
			if (wasJsControllerInstalled)
				await controllerSetup.setupJsController();
			await controllerSetup.setupSystemConfig();
			await controllerSetup.disableAdminInstances();

			await adapterSetup.deleteOldInstances();
			await adapterSetup.addAdapterInstance();

			// Create a copy of the databases that we can restore later
			({
				objects: objectsBackup,
				states: statesBackup,
			} = await dbConnection.readDB());
		});

		beforeEach(async function () {
			this.timeout(30000);

			// Clean up before every single test
			await Promise.all([
				controllerSetup.clearDBDir(),
				controllerSetup.clearLogDir(),
				dbConnection.writeDB(objectsBackup, statesBackup),
			]);

			// Create a new test harness
			harness = new TestHarness(adapterDir, testDir);

			// Enable the adapter and set its loglevel to debug
			await harness.changeAdapterConfig(appName, testDir, adapterName, {
				common: {
					enabled: true,
					loglevel: "debug",
				},
			});

			// Start the controller instance
			await harness.startController();

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
						if (
							options.allowedExitCodes == undefined ||
							options.allowedExitCodes.indexOf(code) === -1
						) {
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
