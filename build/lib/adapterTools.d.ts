/// <reference types="iobroker" />
/**
 * Loads an adapter's io-package.json
 * @param adapterDir The directory the adapter resides in
 */
export declare function loadIoPackage(adapterDir: string): Record<string, any>;
/**
 * Checks if an adapter claims that it supports compact mode
 * @param ioPackage The contents of io-package.json in object format
 */
export declare function adapterShouldSupportCompactMode(ioPackage: Record<string, any>): boolean;
/**
 * Checks if an adapter claims that it supports compact mode
 * @param adapterDir The directory the adapter resides in
 */
export declare function adapterShouldSupportCompactMode(adapterDir: string): boolean;
/**
 * Locates an adapter's main file
 * @param adapterDir The directory the adapter resides in
 */
export declare function locateAdapterMainFile(adapterDir: string): string;
/**
 * Locates an adapter's config to populate the `adapter.config` object with
 * @param adapterDir The directory the adapter resides in
 */
export declare function loadAdapterConfig(adapterDir: string): Record<string, any>;
/**
 * Loads the instanceObjects for an adapter from its `io-package.json`
 * @param adapterDir The directory the adapter resides in
 */
export declare function loadInstanceObjects(adapterDir: string): ioBroker.Object[];
