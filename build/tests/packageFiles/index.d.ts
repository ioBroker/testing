import { type ErrorObject } from 'ajv';
/**
 * Turns the errors of a schema validation into one readable line per error
 *
 * @param errors the errors of the validate function
 */
export declare function formatSchemaErrors(errors: ErrorObject[] | null | undefined): string;
/** Options for {@link validatePackageFiles} */
export interface PackageFilesOptions {
    /** Do not validate `admin/jsonConfig.json(5)`, `admin/jsonCustom.json(5)` and JSON tab files against the jsonConfig schema */
    ignoreJsonConfigValidation?: boolean;
    /** Do not validate `io-package.json` against the io-package.json schema of JS-Controller */
    ignoreIoPackageValidation?: boolean;
}
/**
 * Tests if the adapter files are valid.
 * This is meant to be executed in a mocha context.
 */
export declare function validatePackageFiles(adapterDir: string, options?: PackageFilesOptions): void;
