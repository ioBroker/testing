import type { DBConnection } from './dbConnection';
import { type TestPorts } from './ports';
/** Options for {@link ControllerSetup.setupSystemConfig} */
export interface SystemConfigOptions {
    /** The ports to move the DBs to (default: 19001 / 19000) */
    ports?: Readonly<TestPorts>;
}
export declare class ControllerSetup {
    private adapterDir;
    private testDir;
    constructor(adapterDir: string, testDir: string);
    private appName;
    private adapterName;
    private testAdapterDir;
    private testControllerDir;
    private testDataDir;
    /**
     * Returns the path of the file that stores which JS-Controller version is installed in the test directory
     */
    private getControllerVersionFilePath;
    /**
     * Reads which JS-Controller version was installed in the test directory during the previous run.
     * Returns `null` if this is unknown.
     */
    private getInstalledControllerVersion;
    /**
     * Remembers which JS-Controller version is installed in the test directory
     */
    private saveInstalledControllerVersion;
    /**
     * Removes the installed dependencies and the data directory from the test directory.
     * This is necessary when switching JS-Controller versions, so no stale files and states are left behind.
     */
    private clearTestDir;
    prepareTestDir(controllerVersion?: string): Promise<void>;
    /**
     * Tests if JS-Controller is already installed
     */
    isJsControllerInstalled(): Promise<boolean>;
    /**
     * Tests if an instance of JS-Controller is already running by attempting to connect to the Objects DB
     */
    isJsControllerRunning(): Promise<boolean>;
    /**
     * Sets up an existing JS-Controller instance for testing by executing "iobroker setup first"
     */
    setupJsController(): Promise<void>;
    /**
     * Changes the objects and states db to use alternative ports
     *
     * @param dbConnection The DB connection whose system config is changed
     * @param options Further options, e.g. the ports to move the DBs to
     */
    setupSystemConfig(dbConnection: DBConnection, options?: SystemConfigOptions): void;
    /**
     * Clears the log dir for integration tests (and creates it if it doesn't exist)
     */
    clearLogDir(): Promise<void>;
    /**
     * Clears the sqlite DB dir for integration tests (and creates it if it doesn't exist)
     */
    clearDBDir(): Promise<void>;
    /**
     * Disables all admin instances in the objects DB
     */
    disableAdminInstances(dbConnection: DBConnection): Promise<void>;
}
