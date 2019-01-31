/// <reference types="node" />
import Module from "module";
export declare function createMockRequire(originalRequire: NodeRequire, mocks: Record<string, any>, relativeToFile?: string): (filename: string) => any;
/**
 * Monkey-patches module code before executing it by wrapping it in an IIFE whose arguments are modified (proxied) globals
 * @param code The code to monkey patch
 * @param globals A dictionary of globals and their properties to be replaced
 */
export declare function monkeyPatchGlobals(code: string, globals: Record<string, Record<string, any>>): string;
/** A test-safe replacement for process.exit that throws a specific error instead */
export declare function fakeProcessExit(code?: number): void;
/**
 * Replaces NodeJS's default loader for .js-files with the given one and returns the original one
 */
export declare function replaceJsLoader(loaderFunction: NodeExtensions[string]): NodeExtensions[string];
/**
 * Replaces a replaced loader for .js-files with the original one
 */
export declare function restoreJsLoader(originalJsLoader: NodeExtensions[string]): void;
export interface HarnessOptions {
    /** Mocks for loaded modules */
    mockedModules?: Record<string, Module>;
    /** Whether the main module should believe that it was not required */
    fakeNotRequired?: boolean;
    /** Patches for global objects like `process` */
    globalPatches?: Record<string, Record<string, any>>;
}
/**
 * Loads the given module into the test harness and returns the module's `module.exports`.
 */
export declare function loadModuleInHarness(moduleFilename: string, options?: HarnessOptions): unknown;
