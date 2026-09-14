import { type ErrorObject } from 'ajv';
/**
 * `common.news` is keyed by version numbers, but between two releases it also carries the release-script's
 * `NEXT` placeholder (see {@link NEWS_PLACEHOLDER}). The schema describes the published file, so the placeholder
 * is added here, validated like every other entry: `en` required, only known languages, strings.
 *
 * @param schema the io-package.json schema. It will be modified in place
 */
export declare function adaptSchemaForNewsPlaceholder(schema: Record<string, any>): void;
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
