"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePackageFiles = validatePackageFiles;
const typeguards_1 = require("alcalzone-shared/typeguards");
const chai_1 = require("chai");
const fs = __importStar(require("fs"));
const json5_1 = __importDefault(require("json5"));
const path = __importStar(require("path"));
const ajv_1 = require("ajv");
const axios_1 = __importDefault(require("axios"));
const jsonValidators = {};
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
function adaptSchemaForTab(schema) {
    // The root of the schema is an "if type === 'tabs' then ... else ..." construction
    const roots = [schema.then, schema.else].filter(root => !!root);
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
            root.required = root.required.filter((name) => name !== 'type');
        }
    }
}
/**
 * Compile the JSON schema for `jsonConfig.json` or for a JSON tab and cache the result,
 * as the schema is quite big and it is used with every opened config page or tab
 *
 * @param type `config` for `admin/jsonConfig.json(5)`, `tab` for the JSON file of an admin tab
 */
async function getJsonValidator(type) {
    const subType = type === 'custom' ? 'config' : type;
    if (jsonValidators[subType]) {
        return jsonValidators[subType];
    }
    let schema;
    try {
        console.debug(`retrieving json schema from ${JSON_CONFIG_SCHEMA_URL}`);
        const schemaRes = await axios_1.default.get(JSON_CONFIG_SCHEMA_URL, { timeout: JSON_CONFIG_SCHEMA_TIMEOUT_MS });
        schema = schemaRes.data;
    }
    catch (e) {
        console.error(`Could not get jsonConfig schema: ${e.message}`);
        throw new Error(`Could not get jsonConfig schema`);
    }
    if (type === 'tab') {
        adaptSchemaForTab(schema);
    }
    try {
        const ajv = new ajv_1.Ajv({
            allErrors: false,
            strict: 'log',
        });
        jsonValidators[subType] = ajv.compile(schema);
        return jsonValidators[subType];
    }
    catch (e) {
        console.debug(`Could not compile jsonConfig schema: ${e.message}`);
        throw new Error(`Could not compile jsonConfig schema`);
    }
}
/** Checks that the given path exists and is a file, not a directory */
function isFile(filePath) {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}
async function validateJsonConfig(adapterDir, type = 'config', tabFile) {
    let config;
    if (type === 'config' && fs.existsSync(path.join(adapterDir, 'admin/jsonConfig.json'))) {
        config = JSON.parse(fs.readFileSync(path.join(adapterDir, 'admin/jsonConfig.json'), 'utf-8'));
    }
    else if (type === 'config' && fs.existsSync(path.join(adapterDir, 'admin/jsonConfig.json5'))) {
        config = json5_1.default.parse(fs.readFileSync(path.join(adapterDir, 'admin/jsonConfig.json5'), 'utf-8'));
    }
    else if (type === 'tab' && tabFile && isFile(path.join(adapterDir, `admin/${tabFile}`))) {
        const tabPath = path.join(adapterDir, `admin/${tabFile}`);
        const tabContent = fs.readFileSync(tabPath, 'utf-8');
        config = tabFile.endsWith('5') ? json5_1.default.parse(tabContent) : JSON.parse(tabContent);
    }
    else if (type === 'custom' && fs.existsSync(path.join(adapterDir, `admin/jsonCustom.json`))) {
        config = JSON.parse(fs.readFileSync(path.join(adapterDir, 'admin/jsonCustom.json'), 'utf-8'));
    }
    else if (type === 'custom' && fs.existsSync(path.join(adapterDir, `admin/jsonCustom.json5`))) {
        config = json5_1.default.parse(fs.readFileSync(path.join(adapterDir, 'admin/jsonCustom.json5'), 'utf-8'));
    }
    else {
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
function validatePackageFiles(adapterDir, options) {
    const packageJsonPath = path.join(adapterDir, 'package.json');
    const ioPackageJsonPath = path.join(adapterDir, 'io-package.json');
    // This allows us to skip tests that require valid JSON files
    const invalidFiles = {
        'package.json': false,
        'io-package.json': false,
    };
    function skipIfInvalid(...filenames) {
        if (filenames.some(f => invalidFiles[f])) {
            return this.skip();
        }
    }
    function markAsInvalid(filename) {
        if (this.currentTest.state === 'failed' && invalidFiles[filename] === false) {
            invalidFiles[filename] = true;
            console.error(`Skipping subsequent tests including "${filename}" because they require valid JSON files!`);
        }
    }
    /** Ensures that a given property exists on the target object */
    function ensurePropertyExists(propertyPath, targetObj) {
        const propertyParts = propertyPath.split('.');
        it(`The property "${propertyPath}" exists`, () => {
            let prev = targetObj;
            for (const part of propertyParts) {
                (0, chai_1.expect)(prev[part]).to.not.be.undefined;
                prev = prev[part];
            }
        });
    }
    /**
     * Recursively find all files matching a pattern in a directory
     */
    function findFiles(dir, pattern, results = []) {
        if (!fs.existsSync(dir)) {
            return results;
        }
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                findFiles(filePath, pattern, results);
            }
            else if (pattern.test(file)) {
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
                        (0, chai_1.expect)(fs.existsSync(packagePath), `${filename} is missing in the adapter dir. Please create it!`).to.be.true;
                    });
                    it('contains valid JSON', () => {
                        (0, chai_1.expect)(() => {
                            JSON.parse(fs.readFileSync(packagePath, 'utf8'));
                        }, `${filename} contains invalid JSON!`).not.to.throw();
                    });
                    it('is an object', () => {
                        (0, chai_1.expect)(require(packagePath), `${filename} must contain an object!`).to.be.an('object');
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
                let name = packageContent.name;
                (0, chai_1.expect)(name).to.match(/^iobroker\./, `The npm package name must start with lowercase "iobroker."!`);
                name = name.replace(/^iobroker\./, '');
                (0, chai_1.expect)(name).to.match(/[-a-z0-9_]+/, `The adapter name must only contain lowercase letters, numbers, "-" and "_"!`);
                (0, chai_1.expect)(name).to.match(/^[a-z]/, `The adapter name must start with a letter!`);
                (0, chai_1.expect)(name).to.match(/[a-z0-9]$/, `The adapter name must end with a letter or number!`);
            });
            if (!iopackContent.common.onlyWWW) {
                it(`property main is defined for non onlyWWW adapters`, () => {
                    (0, chai_1.expect)(packageContent.main).to.not.be.undefined;
                });
            }
            it(`The repository type is "git"`, () => {
                (0, chai_1.expect)(packageContent.repository.type).to.equal('git');
            });
            it('npm is not listed as a dependency', () => {
                for (const depType of [
                    'dependencies',
                    'devDependencies',
                    'optionalDependencies',
                    'peerDependencies',
                ]) {
                    if ((0, typeguards_1.isObject)(packageContent[depType]) && 'npm' in packageContent[depType]) {
                        // eslint-disable-next-line @typescript-eslint/only-throw-error
                        throw new chai_1.AssertionError(`npm must not be listed in ${depType}, found "${packageContent[depType].npm}"!`);
                    }
                }
            });
            it('No "prepare" script is defined in package.json', () => {
                if ((0, typeguards_1.isObject)(packageContent.scripts) && 'prepare' in packageContent.scripts) {
                    // eslint-disable-next-line @typescript-eslint/only-throw-error
                    throw new chai_1.AssertionError(`The "prepare" script must not be defined in the "scripts" section of package.json, found "${packageContent.scripts.prepare}"! It runs on every "npm install" of the adapter (including for end users) and can break installations.`);
                }
            });
            it('iobroker.js-controller is not listed as a dependency', () => {
                for (const depType of [
                    'dependencies',
                    'devDependencies',
                    'optionalDependencies',
                    'peerDependencies',
                ]) {
                    if ((0, typeguards_1.isObject)(packageContent[depType]) && 'iobroker.js-controller' in packageContent[depType]) {
                        // eslint-disable-next-line @typescript-eslint/only-throw-error
                        throw new chai_1.AssertionError(`iobroker.js-controller must not be listed in ${depType}, found "${packageContent[depType]['iobroker.js-controller']}"!`);
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
                (0, chai_1.expect)(iopackContent.common.title).not.to.match(/iobroker|adapter/i);
            });
            it(`titleLang is an object to support multiple languages`, () => {
                (0, chai_1.expect)(iopackContent.common.titleLang).to.be.an('object');
            });
            it(`titleLang does not contain "adapter" or "iobroker"`, () => {
                for (const title of Object.values(iopackContent.common.titleLang)) {
                    (0, chai_1.expect)(title).not.to.match(/iobroker|adapter/i);
                }
            });
            it(`The description is an object to support multiple languages`, () => {
                (0, chai_1.expect)(iopackContent.common.desc).to.be.an('object');
            });
            it(`common.authors is an array that is not empty`, () => {
                const authors = iopackContent.common.authors;
                (0, chai_1.expect)((0, typeguards_1.isArray)(authors)).to.be.true;
                (0, chai_1.expect)(authors.length).to.be.at.least(1);
            });
            it(`common.news is an object that contains maximum 20 entries`, () => {
                const news = iopackContent.common.news;
                (0, chai_1.expect)((0, typeguards_1.isObject)(news)).to.be.true;
                (0, chai_1.expect)(Object.keys(news).length).to.be.at.most(20);
            });
            if (iopackContent.common.licenseInformation) {
                it(`if common.licenseInformation exists, it is an object with required properties`, () => {
                    (0, chai_1.expect)(iopackContent.common.licenseInformation).to.be.an('object');
                    (0, chai_1.expect)(iopackContent.common.licenseInformation.type).to.be.oneOf([
                        'free',
                        'commercial',
                        'paid',
                        'limited',
                    ]);
                    if (iopackContent.common.licenseInformation.type !== 'free') {
                        (0, chai_1.expect)(iopackContent.common.licenseInformation.link, 'License link is missing').to.not.be
                            .undefined;
                    }
                });
                it(`common.license should not exist together with common.licenseInformation`, () => {
                    (0, chai_1.expect)(iopackContent.common.license, 'common.license must be removed').to.be.undefined;
                });
            }
            else {
                it(`common.license must exist without common.licenseInformation`, () => {
                    (0, chai_1.expect)(iopackContent.common.license, 'common.licenseInformation (preferred) or common.license (deprecated) must exist').to.not.be.undefined;
                });
            }
            if (iopackContent.common.tier != undefined) {
                it(`common.tier must be 1, 2 or 3`, () => {
                    (0, chai_1.expect)(iopackContent.common.tier).to.be.at.least(1);
                    (0, chai_1.expect)(iopackContent.common.tier).to.be.at.most(3);
                });
            }
            // If the adapter has a configuration page, check that a supported admin UI is used
            const hasNoConfigPage = iopackContent.common.noConfig === true ||
                iopackContent.common.noConfig === 'true' ||
                iopackContent.common.adminUI?.config === 'none';
            if (!hasNoConfigPage) {
                it('The adapter uses a supported admin UI', () => {
                    const hasSupportedUI = !!iopackContent.common.materialize ||
                        iopackContent.common.adminUI?.config === 'html' ||
                        iopackContent.common.adminUI?.config === 'json' ||
                        iopackContent.common.adminUI?.config === 'materialize';
                    (0, chai_1.expect)(hasSupportedUI, 'Unsupported Admin UI, must be html, materialize or JSON config!').to.be
                        .true;
                });
            }
            if (iopackContent.common.adminUI?.config === 'json') {
                it('The JSON config file exists', () => {
                    (0, chai_1.expect)(fs.existsSync(path.join(adapterDir, 'admin/jsonConfig.json')) ||
                        fs.existsSync(path.join(adapterDir, 'admin/jsonConfig.json5')), 'common.adminUI.config is "json", so admin/jsonConfig.json or admin/jsonConfig.json5 must exist!').to.be.true;
                });
                if (!options?.ignoreJsonConfigValidation) {
                    it('Check JSON config file', () => validateJsonConfig(adapterDir, 'config')).timeout(10000);
                }
            }
            if (iopackContent.common.adminUI?.custom === 'json') {
                it('The JSON custom config file exists', () => {
                    (0, chai_1.expect)(fs.existsSync(path.join(adapterDir, 'admin/jsonCustom.json')) ||
                        fs.existsSync(path.join(adapterDir, 'admin/jsonCustom.json5')), 'common.adminUI.custom is "json", so admin/jsonCustom.json or admin/jsonCustom.json5 must exist!').to.be.true;
                });
                if (!options?.ignoreJsonConfigValidation) {
                    it('Check JSON custom config file', () => validateJsonConfig(adapterDir, 'custom')).timeout(10000);
                }
            }
            if (iopackContent.common.adminUI?.tab === 'json') {
                const link = (iopackContent.common.adminTab?.link || '').split('?')[0];
                it('The JSON tab file is referenced correctly', () => {
                    (0, chai_1.expect)(link.endsWith('.json') || link.endsWith('.json5'), 'common.adminUI.tab is "json", so common.adminTab.link must point to a .json or .json5 file!').to.be.true;
                    (0, chai_1.expect)(!link.includes('..') && !link.includes('://') && !link.includes('%'), 'common.adminTab.link must be a file name relative to the admin directory!').to.be.true;
                });
                if (!options?.ignoreJsonConfigValidation) {
                    it('Check JSON tab file', () => validateJsonConfig(adapterDir, 'tab', link)).timeout(10000);
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
                (0, chai_1.expect)(`iobroker.${iopackContent.common.name}`).to.equal(packageContent.name);
            });
            it('The version matches', () => {
                (0, chai_1.expect)(iopackContent.common.version).to.equal(packageContent.version);
            });
            it('The license matches', () => {
                if (iopackContent.common.licenseInformation) {
                    (0, chai_1.expect)(iopackContent.common.licenseInformation.license).to.equal(packageContent.license);
                }
                else {
                    (0, chai_1.expect)(iopackContent.common.license).to.equal(packageContent.license);
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
                            (0, chai_1.expect)(() => {
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
            const adminDirectJsonFiles = allAdminJsonFiles.filter(file => !file.includes(`${path.sep}i18n${path.sep}`) && !file.endsWith(`${path.sep}tsconfig.json`));
            const i18nJsonFiles = allAdminJsonFiles.filter(file => file.includes(`${path.sep}i18n${path.sep}`));
            if (adminDirectJsonFiles.length > 0) {
                describe(`admin/*.json files`, () => {
                    for (const filePath of adminDirectJsonFiles) {
                        const relativePath = path.relative(adapterDir, filePath);
                        it(`${relativePath} contains valid JSON`, () => {
                            (0, chai_1.expect)(() => {
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
                            (0, chai_1.expect)(() => {
                                json5_1.default.parse(fs.readFileSync(filePath, 'utf8'));
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
                            (0, chai_1.expect)(() => {
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
            (0, chai_1.expect)(fs.existsSync(path.join(adapterDir, 'README.md')), `README.md is missing in the adapter dir. Please create it!`).to.be.true;
        });
        it('LICENSE exists or is present in the README.md', () => {
            const licenseExists = fs.existsSync(path.join(adapterDir, 'LICENSE'));
            if (licenseExists) {
                return;
            }
            const readmeContent = fs.readFileSync(path.join(adapterDir, 'README.md'), 'utf8');
            (0, chai_1.expect)(readmeContent).to.match(/## LICENSE/i, `The license should be in a file "LICENSE" or be included in "README.md" as a 2nd level headline!`);
        });
    });
}
