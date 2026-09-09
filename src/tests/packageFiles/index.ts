import { isArray, isObject } from 'alcalzone-shared/typeguards';
import { AssertionError, expect } from 'chai';
import * as fs from 'fs';
import JSON5 from 'json5';
import * as path from 'path';
import { Ajv, type ValidateFunction } from 'ajv';
import axios from 'axios';

const jsonValidators: { config?: ValidateFunction; tab?: ValidateFunction } = {};

/** URL to the JSON config schema */
const JSON_CONFIG_SCHEMA_URL = 'https://raw.githubusercontent.com/ioBroker/json-config/main/schemas/jsonConfig.json';

/** Timeout for downloading the JSON config schema, so a hanging request cannot block the test run */
const JSON_CONFIG_SCHEMA_TIMEOUT_MS = 10000;

/**
 * A JSON tab (`common.adminTab.link`) has the same format as `jsonConfig.json`, with two differences:
 * its root may have a `command` (message that is sent to the instance when the tab is opened),
 * and its root `type` may be omitted, because it defaults to `panel`.
 *
 * @param schema the jsonConfig schema. It will be modified in place
 */
function adaptSchemaForTab(schema: Record<string, any>): void {
    // The root of the schema is an "if type === 'tabs' then ... else ..." construction
    const roots: Record<string, any>[] = [schema.then, schema.else].filter(root => !!root);
    if (!roots.length) {
        roots.push(schema);
    }

    for (const root of roots) {
        root.properties ||= {};
        root.properties.command = {
            description: 'Message that is sent to the instance as the tab is opened',
            type: 'string',
        };
        if (Array.isArray(root.required)) {
            root.required = root.required.filter((name: string) => name !== 'type');
        }
    }
}

/**
 * Compile the JSON schema for `jsonConfig.json` or for a JSON tab and cache the result,
 * as the schema is quite big and it is used with every opened config page or tab
 *
 * @param type `config` for `admin/jsonConfig.json(5)`, `tab` for the JSON file of an admin tab
 */
async function getJsonValidator(type: 'config' | 'tab' | 'custom'): Promise<ValidateFunction> {
    const subType = type === 'custom' ? 'config' : type;
    if (jsonValidators[subType]) {
        return jsonValidators[subType];
    }

    let schema: Record<string, any>;
    try {
        console.debug(`retrieving json schema from ${JSON_CONFIG_SCHEMA_URL}`);
        const schemaRes = await axios.get(JSON_CONFIG_SCHEMA_URL, { timeout: JSON_CONFIG_SCHEMA_TIMEOUT_MS });
        schema = schemaRes.data as Record<string, any>;
    } catch (e) {
        console.error(`Could not get jsonConfig schema: ${(e as Error).message}`);
        throw new Error(`Could not get jsonConfig schema`);
    }

    if (type === 'tab') {
        adaptSchemaForTab(schema);
    }

    try {
        const ajv = new Ajv({
            allErrors: false,
            strict: 'log',
        });

        jsonValidators[subType] = ajv.compile(schema);
        return jsonValidators[subType];
    } catch (e) {
        console.debug(`Could not compile jsonConfig schema: ${(e as Error).message}`);
        throw new Error(`Could not compile jsonConfig schema`);
    }
}

/** Checks that the given path exists and is a file, not a directory */
function isFile(filePath: string): boolean {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

async function validateJsonConfig(
    adapterDir: string,
    type: 'config' | 'tab' | 'custom' = 'config',
    tabFile?: string,
): Promise<void> {
    let config: Record<string, any>;
    if (type === 'config' && fs.existsSync(path.join(adapterDir, 'admin/jsonConfig.json'))) {
        config = JSON.parse(fs.readFileSync(path.join(adapterDir, 'admin/jsonConfig.json'), 'utf-8'));
    } else if (type === 'config' && fs.existsSync(path.join(adapterDir, 'admin/jsonConfig.json5'))) {
        config = JSON5.parse(fs.readFileSync(path.join(adapterDir, 'admin/jsonConfig.json5'), 'utf-8'));
    } else if (type === 'tab' && tabFile && isFile(path.join(adapterDir, `admin/${tabFile}`))) {
        const tabPath = path.join(adapterDir, `admin/${tabFile}`);
        const tabContent = fs.readFileSync(tabPath, 'utf-8');
        config = tabFile.endsWith('5') ? JSON5.parse(tabContent) : JSON.parse(tabContent);
    } else if (type === 'custom' && fs.existsSync(path.join(adapterDir, `admin/jsonCustom.json`))) {
        config = JSON.parse(fs.readFileSync(path.join(adapterDir, 'admin/jsonCustom.json'), 'utf-8'));
    } else if (type === 'custom' && fs.existsSync(path.join(adapterDir, `admin/jsonCustom.json5`))) {
        config = JSON5.parse(fs.readFileSync(path.join(adapterDir, 'admin/jsonCustom.json5'), 'utf-8'));
    } else {
        return;
    }

    const validate = await getJsonValidator(type);

    if (!validate(config)) {
        throw new Error(`Invalid ${type} schema for ${adapterDir}: ${JSON.stringify(validate.errors, null, 2)}`);
    }
}

/**
 * Tests if the adapter files are valid.
 * This is meant to be executed in a mocha context.
 */
export function validatePackageFiles(adapterDir: string, options?: { ignoreJsonConfigValidation?: boolean }): void {
    const packageJsonPath = path.join(adapterDir, 'package.json');
    const ioPackageJsonPath = path.join(adapterDir, 'io-package.json');

    // This allows us to skip tests that require valid JSON files
    const invalidFiles: Record<string, boolean> = {
        'package.json': false,
        'io-package.json': false,
    };
    function skipIfInvalid(this: Mocha.Context, ...filenames: string[]): void | never {
        if (filenames.some(f => invalidFiles[f])) {
            return this.skip();
        }
    }
    function markAsInvalid(this: Mocha.Context, filename: string): void {
        if (this.currentTest!.state === 'failed' && invalidFiles[filename] === false) {
            invalidFiles[filename] = true;
            console.error(`Skipping subsequent tests including "${filename}" because they require valid JSON files!`);
        }
    }

    /** Ensures that a given property exists on the target object */
    function ensurePropertyExists(propertyPath: string, targetObj: any): void {
        const propertyParts = propertyPath.split('.');
        it(`The property "${propertyPath}" exists`, () => {
            let prev = targetObj;
            for (const part of propertyParts) {
                expect(prev[part]).to.not.be.undefined;
                prev = prev[part];
            }
        });
    }

    /**
     * Recursively find all files matching a pattern in a directory
     */
    function findFiles(dir: string, pattern: RegExp, results: string[] = []): string[] {
        if (!fs.existsSync(dir)) {
            return results;
        }

        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                findFiles(filePath, pattern, results);
            } else if (pattern.test(file)) {
                results.push(filePath);
            }
        }

        return results;
    }

    describe(`Validate the package files`, () => {
        describe(`Ensure they are readable`, () => {
            for (const filename of ['package.json', 'io-package.json']) {
                const packagePath = path.join(adapterDir, filename);

                describe(`${filename}`, () => {
                    afterEach(function () {
                        markAsInvalid.call(this, filename);
                    });
                    beforeEach(function () {
                        skipIfInvalid.call(this, filename);
                    });

                    it('exists', () => {
                        expect(
                            fs.existsSync(packagePath),
                            `${filename} is missing in the adapter dir. Please create it!`,
                        ).to.be.true;
                    });

                    it('contains valid JSON', () => {
                        expect(() => {
                            JSON.parse(fs.readFileSync(packagePath, 'utf8'));
                        }, `${filename} contains invalid JSON!`).not.to.throw();
                    });

                    it('is an object', () => {
                        expect(require(packagePath), `${filename} must contain an object!`).to.be.an('object');
                    });
                });
            }
        });

        describe(`Check contents of package.json`, () => {
            beforeEach(function () {
                skipIfInvalid.call(this, 'package.json');
            });

            const packageContent = require(packageJsonPath);
            const iopackContent = require(ioPackageJsonPath);

            const requiredProperties = [
                'name',
                'version',
                'description',
                'author',
                'license',
                'repository',
                'repository.type',
            ];
            requiredProperties.forEach(prop => ensurePropertyExists(prop, packageContent));

            it('The package name is correct', () => {
                let name: string = packageContent.name;
                expect(name).to.match(/^iobroker\./, `The npm package name must start with lowercase "iobroker."!`);
                name = name.replace(/^iobroker\./, '');

                expect(name).to.match(
                    /[-a-z0-9_]+/,
                    `The adapter name must only contain lowercase letters, numbers, "-" and "_"!`,
                );
                expect(name).to.match(/^[a-z]/, `The adapter name must start with a letter!`);
                expect(name).to.match(/[a-z0-9]$/, `The adapter name must end with a letter or number!`);
            });

            if (!iopackContent.common.onlyWWW) {
                it(`property main is defined for non onlyWWW adapters`, () => {
                    expect(packageContent.main).to.not.be.undefined;
                });
            }

            it(`The repository type is "git"`, () => {
                expect(packageContent.repository.type).to.equal('git');
            });

            it('npm is not listed as a dependency', () => {
                for (const depType of [
                    'dependencies',
                    'devDependencies',
                    'optionalDependencies',
                    'peerDependencies',
                ] as const) {
                    if (isObject(packageContent[depType]) && 'npm' in packageContent[depType]) {
                        // eslint-disable-next-line @typescript-eslint/only-throw-error
                        throw new AssertionError(
                            `npm must not be listed in ${depType}, found "${packageContent[depType].npm}"!`,
                        );
                    }
                }
            });

            it('No "prepare" script is defined in package.json', () => {
                if (isObject(packageContent.scripts) && 'prepare' in packageContent.scripts) {
                    // eslint-disable-next-line @typescript-eslint/only-throw-error
                    throw new AssertionError(
                        `The "prepare" script must not be defined in the "scripts" section of package.json, found "${packageContent.scripts.prepare}"! It runs on every "npm install" of the adapter (including for end users) and can break installations.`,
                    );
                }
            });

            it('iobroker.js-controller is not listed as a dependency', () => {
                for (const depType of [
                    'dependencies',
                    'devDependencies',
                    'optionalDependencies',
                    'peerDependencies',
                ] as const) {
                    if (isObject(packageContent[depType]) && 'iobroker.js-controller' in packageContent[depType]) {
                        // eslint-disable-next-line @typescript-eslint/only-throw-error
                        throw new AssertionError(
                            `iobroker.js-controller must not be listed in ${depType}, found "${packageContent[depType]['iobroker.js-controller']}"!`,
                        );
                    }
                }
            });
        });

        describe(`Check contents of io-package.json`, () => {
            beforeEach(function () {
                skipIfInvalid.call(this, 'io-package.json');
            });

            const iopackContent = require(ioPackageJsonPath);

            const requiredProperties = [
                'common.name',
                'common.titleLang',
                'common.version',
                'common.news',
                'common.desc',
                'common.icon',
                'common.extIcon',
                'common.type',
                'common.authors',
                'native',
            ];
            requiredProperties.forEach(prop => ensurePropertyExists(prop, iopackContent));

            it(`The title does not contain "adapter" or "iobroker"`, () => {
                if (!iopackContent.title) {
                    return;
                }
                expect(iopackContent.common.title).not.to.match(/iobroker|adapter/i);
            });
            it(`titleLang is an object to support multiple languages`, () => {
                expect(iopackContent.common.titleLang).to.be.an('object');
            });
            it(`titleLang does not contain "adapter" or "iobroker"`, () => {
                for (const title of Object.values(iopackContent.common.titleLang)) {
                    expect(title).not.to.match(/iobroker|adapter/i);
                }
            });
            it(`The description is an object to support multiple languages`, () => {
                expect(iopackContent.common.desc).to.be.an('object');
            });
            it(`common.authors is an array that is not empty`, () => {
                const authors = iopackContent.common.authors;
                expect(isArray(authors)).to.be.true;
                expect(authors.length).to.be.at.least(1);
            });

            it(`common.news is an object that contains maximum 20 entries`, () => {
                const news = iopackContent.common.news;
                expect(isObject(news)).to.be.true;
                expect(Object.keys(news).length).to.be.at.most(20);
            });

            if (iopackContent.common.licenseInformation) {
                it(`if common.licenseInformation exists, it is an object with required properties`, () => {
                    expect(iopackContent.common.licenseInformation).to.be.an('object');
                    expect(iopackContent.common.licenseInformation.type).to.be.oneOf([
                        'free',
                        'commercial',
                        'paid',
                        'limited',
                    ]);

                    if (iopackContent.common.licenseInformation.type !== 'free') {
                        expect(iopackContent.common.licenseInformation.link, 'License link is missing').to.not.be
                            .undefined;
                    }
                });

                it(`common.license should not exist together with common.licenseInformation`, () => {
                    expect(iopackContent.common.license, 'common.license must be removed').to.be.undefined;
                });
            } else {
                it(`common.license must exist without common.licenseInformation`, () => {
                    expect(
                        iopackContent.common.license,
                        'common.licenseInformation (preferred) or common.license (deprecated) must exist',
                    ).to.not.be.undefined;
                });
            }

            if (iopackContent.common.tier != undefined) {
                it(`common.tier must be 1, 2 or 3`, () => {
                    expect(iopackContent.common.tier).to.be.at.least(1);
                    expect(iopackContent.common.tier).to.be.at.most(3);
                });
            }

            // If the adapter has a configuration page, check that a supported admin UI is used
            const hasNoConfigPage =
                iopackContent.common.noConfig === true ||
                iopackContent.common.noConfig === 'true' ||
                iopackContent.common.adminUI?.config === 'none';
            if (!hasNoConfigPage) {
                it('The adapter uses a supported admin UI', () => {
                    const hasSupportedUI =
                        !!iopackContent.common.materialize ||
                        iopackContent.common.adminUI?.config === 'html' ||
                        iopackContent.common.adminUI?.config === 'json' ||
                        iopackContent.common.adminUI?.config === 'materialize';

                    expect(hasSupportedUI, 'Unsupported Admin UI, must be html, materialize or JSON config!').to.be
                        .true;
                });
            }
            if (iopackContent.common.adminUI?.config === 'json') {
                it('The JSON config file exists', () => {
                    expect(
                        fs.existsSync(path.join(adapterDir, 'admin/jsonConfig.json')) ||
                            fs.existsSync(path.join(adapterDir, 'admin/jsonConfig.json5')),
                        'common.adminUI.config is "json", so admin/jsonConfig.json or admin/jsonConfig.json5 must exist!',
                    ).to.be.true;
                });
                if (!options?.ignoreJsonConfigValidation) {
                    it('Check JSON config file', () => validateJsonConfig(adapterDir, 'config'));
                }
            }
            if (iopackContent.common.adminUI?.custom === 'json') {
                it('The JSON custom config file exists', () => {
                    expect(
                        fs.existsSync(path.join(adapterDir, 'admin/jsonCustom.json')) ||
                            fs.existsSync(path.join(adapterDir, 'admin/jsonCustom.json5')),
                        'common.adminUI.custom is "json", so admin/jsonCustom.json or admin/jsonCustom.json5 must exist!',
                    ).to.be.true;
                });
                if (!options?.ignoreJsonConfigValidation) {
                    it('Check JSON custom config file', () => validateJsonConfig(adapterDir, 'custom'));
                }
            }
            if (iopackContent.common.adminUI?.tab === 'json') {
                const link = (iopackContent.common.adminTab?.link || '').split('?')[0];
                it('The JSON tab file is referenced correctly', () => {
                    expect(
                        link.endsWith('.json') || link.endsWith('.json5'),
                        'common.adminUI.tab is "json", so common.adminTab.link must point to a .json or .json5 file!',
                    ).to.be.true;
                    expect(
                        !link.includes('..') && !link.includes('://') && !link.includes('%'),
                        'common.adminTab.link must be a file name relative to the admin directory!',
                    ).to.be.true;
                });
                if (!options?.ignoreJsonConfigValidation) {
                    it('Check JSON tab file', () => validateJsonConfig(adapterDir, 'tab', link));
                }
            }
        });

        describe(`Compare contents of package.json and io-package.json`, () => {
            beforeEach(function () {
                skipIfInvalid.call(this, 'package.json', 'io-package.json');
            });

            const packageContent = require(packageJsonPath);
            const iopackContent = require(ioPackageJsonPath);

            it('The name matches', () => {
                expect(`iobroker.${iopackContent.common.name}`).to.equal(packageContent.name);
            });

            it('The version matches', () => {
                expect(iopackContent.common.version).to.equal(packageContent.version);
            });

            it('The license matches', () => {
                if (iopackContent.common.licenseInformation) {
                    expect(iopackContent.common.licenseInformation.license).to.equal(packageContent.license);
                } else {
                    expect(iopackContent.common.license).to.equal(packageContent.license);
                }
            });
        });

        describe(`Validate JSON files`, () => {
            // Validate base directory JSON files
            describe(`Base directory JSON files`, () => {
                for (const filename of ['package.json', 'io-package.json']) {
                    const filePath = path.join(adapterDir, filename);
                    if (fs.existsSync(filePath)) {
                        it(`${filename} contains valid JSON`, () => {
                            expect(() => {
                                JSON.parse(fs.readFileSync(filePath, 'utf8'));
                            }, `${filename} contains invalid JSON!`).not.to.throw();
                        });
                    }
                }
            });

            // Find all JSON and JSON5 files in admin/ directory (recursively)
            const adminDir = path.join(adapterDir, 'admin');
            const allAdminJsonFiles = findFiles(adminDir, /\.json$/);
            const allAdminJson5Files = findFiles(adminDir, /\.json5$/);

            // Split JSON files into admin/*.json and admin/i18n/**/*.json
            // Exclude tsconfig.json as it may contain JSON5 syntax (comments, trailing commas)
            const adminDirectJsonFiles = allAdminJsonFiles.filter(
                file => !file.includes(`${path.sep}i18n${path.sep}`) && !file.endsWith(`${path.sep}tsconfig.json`),
            );
            const i18nJsonFiles = allAdminJsonFiles.filter(file => file.includes(`${path.sep}i18n${path.sep}`));

            if (adminDirectJsonFiles.length > 0) {
                describe(`admin/*.json files`, () => {
                    for (const filePath of adminDirectJsonFiles) {
                        const relativePath = path.relative(adapterDir, filePath);
                        it(`${relativePath} contains valid JSON`, () => {
                            expect(() => {
                                JSON.parse(fs.readFileSync(filePath, 'utf8'));
                            }, `${relativePath} contains invalid JSON!`).not.to.throw();
                        });
                    }
                });
            }

            if (allAdminJson5Files.length > 0) {
                describe(`admin/*.json5 files`, () => {
                    for (const filePath of allAdminJson5Files) {
                        const relativePath = path.relative(adapterDir, filePath);
                        it(`${relativePath} contains valid JSON5`, () => {
                            expect(() => {
                                JSON5.parse(fs.readFileSync(filePath, 'utf8'));
                            }, `${relativePath} contains invalid JSON5!`).not.to.throw();
                        });
                    }
                });
            }

            if (i18nJsonFiles.length > 0) {
                describe(`admin/i18n/**/*.json files`, () => {
                    for (const filePath of i18nJsonFiles) {
                        const relativePath = path.relative(adapterDir, filePath);
                        it(`${relativePath} contains valid JSON`, () => {
                            expect(() => {
                                JSON.parse(fs.readFileSync(filePath, 'utf8'));
                            }, `${relativePath} contains invalid JSON!`).not.to.throw();
                        });
                    }
                });
            }
        });
    });

    describe(`Check additional files`, () => {
        it('README.md exists', () => {
            expect(
                fs.existsSync(path.join(adapterDir, 'README.md')),
                `README.md is missing in the adapter dir. Please create it!`,
            ).to.be.true;
        });

        it('LICENSE exists or is present in the README.md', () => {
            const licenseExists = fs.existsSync(path.join(adapterDir, 'LICENSE'));
            if (licenseExists) {
                return;
            }

            const readmeContent = fs.readFileSync(path.join(adapterDir, 'README.md'), 'utf8');
            expect(readmeContent).to.match(
                /## LICENSE/i,
                `The license should be in a file "LICENSE" or be included in "README.md" as a 2nd level headline!`,
            );
        });
    });
}
