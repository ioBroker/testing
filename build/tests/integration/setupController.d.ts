/**
 * Tests if JS-Controller is already installed
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
export declare function isJsControllerInstalled(appName: string, testDir: string): Promise<boolean>;
/**
 * Tests if an instance of JS-Controller is already running by attempting to connect to the Objects DB
 */
export declare function isJsControllerRunning(): Promise<boolean>;
/**
 * Installs a new instance of JS-Controller into the test directory
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
export declare function installJsController(appName: string, testDir: string): Promise<void>;
/**
 * Sets up an existing JS-Controller instance for testing by executing "iobroker setup first"
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
export declare function setupJsController(appName: string, testDir: string): Promise<void>;
/**
 * Changes the objects and states db to use alternative ports
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
export declare function setupDatabases(appName: string, testDir: string): Promise<void>;
