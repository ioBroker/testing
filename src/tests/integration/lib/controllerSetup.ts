// Add debug logging for tests
import debugModule from 'debug';
import { emptyDir, ensureDir, pathExists, readFile, unlink, writeFile, writeJSON } from 'fs-extra';
import { Socket } from 'node:net';
import * as path from 'node:path';
import { getAdapterName, getAppName } from '../../../lib/adapterTools';
import { executeCommand } from '../../../lib/executeCommand';
import type { DBConnection } from './dbConnection';
import { getTestAdapterDir, getTestControllerDir, getTestDBDir, getTestDataDir, getTestLogDir } from './tools';

const debug = debugModule('testing:integration:ControllerSetup');

export class ControllerSetup {
    public constructor(
        private adapterDir: string,
        private testDir: string,
    ) {
        debug('Creating ControllerSetup...');

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

    /**
     * Returns the path of the file that stores which JS-Controller version is installed in the test directory
     */
    private getControllerVersionFilePath(): string {
        return path.join(this.testDir, '.controller-version');
    }

    /**
     * Reads which JS-Controller version was installed in the test directory during the previous run.
     * Returns `null` if this is unknown.
     */
    private async getInstalledControllerVersion(): Promise<string | null> {
        const versionFilePath = this.getControllerVersionFilePath();
        try {
            if (!(await pathExists(versionFilePath))) {
                return null;
            }
            const version = await readFile(versionFilePath, 'utf8');
            return version.trim() || null;
        } catch (e) {
            debug(`Could not read the installed JS-Controller version: ${e as Error}`);
            return null;
        }
    }

    /**
     * Remembers which JS-Controller version is installed in the test directory
     */
    private async saveInstalledControllerVersion(controllerVersion: string): Promise<void> {
        try {
            await writeFile(this.getControllerVersionFilePath(), controllerVersion, 'utf8');
        } catch (e) {
            debug(`Could not save the installed JS-Controller version: ${e as Error}`);
        }
    }

    /**
     * Removes the installed dependencies and the data directory from the test directory.
     * This is necessary when switching JS-Controller versions, so no stale files and states are left behind.
     */
    private async clearTestDir(): Promise<void> {
        debug('Clearing the test directory...');
        await emptyDir(path.join(this.testDir, 'node_modules'));
        await emptyDir(this.testDataDir);
        await this.clearLogDir();
        debug('  => done!');
    }

    public async prepareTestDir(controllerVersion?: string): Promise<void> {
        const nodeMajorVersion = parseInt(process.versions.node.split('.')[0], 10);

        // js-controller 7.2.3 dropped support for Node.js 18 and 20. If no specific
        // version was requested, and we are running on such a Node.js version, pin
        // js-controller to the last version that still supports it.
        if (!controllerVersion) {
            controllerVersion = nodeMajorVersion <= 20 ? '7.2.2' : 'dev';
        }

        debug(`Preparing the test directory. JS-Controller version: "${controllerVersion}"...`);
        // Make sure the test dir exists
        await ensureDir(this.testDir);

        // If the test directory was previously used with a different JS-Controller version,
        // remove the installed files and the data directory, so no stale state is left behind
        const installedControllerVersion = await this.getInstalledControllerVersion();
        if (installedControllerVersion && installedControllerVersion !== controllerVersion) {
            debug(
                `JS-Controller version changed from "${installedControllerVersion}" to "${controllerVersion}", cleaning up...`,
            );
            await this.clearTestDir();
        }

        // Write the package.json
        const packageJson = {
            name: path.basename(this.testDir),
            version: '1.0.0',
            main: 'index.js',
            scripts: {
                test: 'echo "Error: no test specified" && exit 1',
            },
            keywords: [],
            author: '',
            license: 'ISC',
            dependencies: {
                [`${this.appName}.js-controller`]: controllerVersion,
                // @alcalzone/esbuild-register is needed to run TypeScript adapters
                '@alcalzone/esbuild-register': '^2.5.1-1',
            },
            description: '',
        };
        await writeJSON(path.join(this.testDir, 'package.json'), packageJson, {
            spaces: 2,
        });

        // Delete a possible package-lock.json as it can mess with future installations
        const pckLockPath = path.join(this.testDir, 'package-lock.json');
        if (await pathExists(pckLockPath)) {
            await unlink(pckLockPath);
        }

        // Set the engineStrict flag on new Node.js versions to be in line with newer ioBroker installations
        if (nodeMajorVersion >= 10) {
            await writeFile(path.join(this.testDir, '.npmrc'), 'engine-strict=true', 'utf8');
        }

        // Remember if JS-Controller is installed already. If so, we need to call `setup first` afterwards
        const wasJsControllerInstalled = await this.isJsControllerInstalled();
        // Defer to npm to install the controller (if it wasn't already)
        debug('(Re-)installing JS Controller...');
        await executeCommand('npm', ['i', '--omit=dev'], {
            cwd: this.testDir,
            stderr: 'pipe',
        });
        // Prepare/clean the databases and config
        if (wasJsControllerInstalled) {
            await this.setupJsController();
        }

        // Remember which version is installed now, so we can detect a version change on the next run
        await this.saveInstalledControllerVersion(controllerVersion);

        debug('  => done!');
    }

    /**
     * Tests if JS-Controller is already installed
     */
    async isJsControllerInstalled(): Promise<boolean> {
        debug('Testing if JS-Controller is installed...');
        // We expect js-controller to be installed if the dir in <testDir>/node_modules and the data directory exist
        const isInstalled = (await pathExists(this.testControllerDir)) && (await pathExists(this.testDataDir));
        debug(`  => ${isInstalled}`);
        return isInstalled;
    }

    /**
     * Tests if an instance of JS-Controller is already running by attempting to connect to the Objects DB
     */
    public isJsControllerRunning(): Promise<boolean> {
        debug('Testing if JS-Controller is running...');
        return new Promise<boolean>(resolve => {
            const client = new Socket();

            const timeout = setTimeout(() => {
                // Assume the connection failed after 1 s
                client.destroy();
                debug(`  => false`);
                resolve(false);
            }, 1000);

            // Try to connect to an existing ObjectsDB
            client
                .connect({
                    port: 9000,
                    host: '127.0.0.1',
                })
                .on('connect', () => {
                    // The connection succeeded
                    client.destroy();
                    debug(`  => true`);
                    clearTimeout(timeout);
                    resolve(true);
                })
                .on('error', () => {
                    client.destroy();
                    debug(`  => false`);
                    clearTimeout(timeout);
                    resolve(false);
                });
        });
    }

    // /**
    //  * Installs a new instance of JS-Controller into the test directory
    //  * @param appName The branded name of "iobroker"
    //  * @param testDir The directory the integration tests are executed in
    //  */
    // public async installJsController(): Promise<void> {
    // 	debug("Installing newest JS-Controller from github...");
    // 	// First npm install the JS-Controller into the correct directory
    // 	const installUrl = `${this.appName}/${this.appName}.js-controller`;
    // 	const installResult = await executeCommand(
    // 		"npm",
    // 		["i", installUrl, "--save"],
    // 		{
    // 			cwd: this.testDir,
    // 		},
    // 	);
    // 	if (installResult.exitCode !== 0)
    // 		throw new Error("JS-Controller could not be installed!");
    // 	debug("  => done!");
    // }

    /**
     * Sets up an existing JS-Controller instance for testing by executing "iobroker setup first"
     */
    async setupJsController(): Promise<void> {
        debug('Initializing JS-Controller installation...');
        // Stop the controller before calling setup first
        await executeCommand('node', [`${this.appName}.js`, 'stop'], {
            cwd: this.testControllerDir,
            stdout: 'ignore',
            stderr: 'pipe',
        });

        const setupResult = await executeCommand('node', [`${this.appName}.js`, 'setup', 'first', '--console'], {
            cwd: this.testControllerDir,
            stdout: 'ignore',
            stderr: 'pipe',
        });
        if (setupResult.exitCode !== 0) {
            const errorMessage = setupResult.stderr
                ? `${this.appName} setup first failed!\nstderr: ${setupResult.stderr}`
                : `${this.appName} setup first failed!`;
            throw new Error(errorMessage);
        }
        debug('  => done!');
    }

    /**
     * Changes the objects and states db to use alternative ports
     */
    public setupSystemConfig(dbConnection: DBConnection): void {
        debug(`Moving databases to different ports...`);

        const systemConfig = dbConnection.getSystemConfig();
        systemConfig.objects.port = 19001;
        systemConfig.states.port = 19000;
        dbConnection.setSystemConfig(systemConfig);
        debug('  => done!');
    }

    /**
     * Clears the log dir for integration tests (and creates it if it doesn't exist)
     */
    public clearLogDir(): Promise<void> {
        debug('Cleaning log directory...');
        return emptyDir(getTestLogDir(this.appName, this.testDir));
    }

    /**
     * Clears the sqlite DB dir for integration tests (and creates it if it doesn't exist)
     */
    public clearDBDir(): Promise<void> {
        debug('Cleaning SQLite directory...');
        return emptyDir(getTestDBDir(this.appName, this.testDir));
    }

    /**
     * Disables all admin instances in the objects DB
     */
    public async disableAdminInstances(dbConnection: DBConnection): Promise<void> {
        debug('Disabling admin instances...');
        const instanceObjects = await dbConnection.getObjectViewAsync('system', 'instance', {
            startkey: 'system.adapter.admin.',
            endkey: 'system.adapter.admin.\u9999',
        });
        for (const { id, value: obj } of instanceObjects.rows) {
            if (obj && obj.common) {
                obj.common.enabled = false;
                await dbConnection.setObject(id, obj);
            }
        }
        debug('  => done!');
    }
}
