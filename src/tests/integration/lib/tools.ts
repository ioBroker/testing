import * as path from 'path';
import { getAdapterFullName } from '../../../lib/adapterTools';

/**
 * Locates the directory where JS-Controller is installed for integration tests
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
export function getTestControllerDir(appName: string, testDir: string): string {
    return path.resolve(testDir, 'node_modules', `${appName}.js-controller`);
}

/**
 * Locates the directory where JS-Controller stores its data for integration tests
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
export function getTestDataDir(appName: string, testDir: string): string {
    return path.resolve(testDir, `${appName}-data`);
}

/**
 * Locates the directory where JS-Controller stores its logs for integration tests
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
export function getTestLogDir(appName: string, testDir: string): string {
    return path.resolve(testDir, 'log');
}

/**
 * Locates the directory where JS-Controller stores its sqlite db during integration tests
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
export function getTestDBDir(appName: string, testDir: string): string {
    return path.resolve(getTestDataDir(appName, testDir), 'sqlite');
}

/**
 * Locates the directory where the adapter will be be stored for integration tests
 * @param adapterDir The root directory of the adapter
 * @param testDir The directory the integration tests are executed in
 */
export function getTestAdapterDir(adapterDir: string, testDir: string): string {
    const adapterName = getAdapterFullName(adapterDir);
    return path.resolve(testDir, 'node_modules', adapterName);
}
