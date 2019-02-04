"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_extra_1 = require("fs-extra");
const path = __importStar(require("path"));
const adapterTools_1 = require("../../../lib/adapterTools");
const executeCommand_1 = require("../../../lib/executeCommand");
const tools_1 = require("./tools");
// Add debug logging for tests
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("testing:integration:AdapterSetup");
class AdapterSetup {
    constructor(adapterDir, testDir, dbConnection) {
        this.adapterDir = adapterDir;
        this.testDir = testDir;
        this.dbConnection = dbConnection;
        debug("Creating AdapterSetup...");
        this.adapterName = adapterTools_1.getAdapterName(this.adapterDir);
        this.adapterFullName = adapterTools_1.getAdapterFullName(this.adapterDir);
        this.appName = adapterTools_1.getAppName(this.adapterDir);
        this.testAdapterDir = tools_1.getTestAdapterDir(this.adapterDir, this.testDir);
        this.testControllerDir = tools_1.getTestControllerDir(this.appName, this.testDir);
        debug(`  directories:`);
        debug(`    controller: ${this.testControllerDir}`);
        debug(`    adapter:    ${this.testAdapterDir}`);
        debug(`  appName:           ${this.appName}`);
        debug(`  adapterName:       ${this.adapterName}`);
    }
    /**
     * Tests if the adapter is already installed in the test directory
     */
    isAdapterInstalled() {
        return __awaiter(this, void 0, void 0, function* () {
            // We expect the adapter to be installed if the dir in <testDir>/node_modules exists
            return fs_extra_1.pathExists(this.testAdapterDir);
        });
    }
    /** Copies all adapter files (except a few) to the test directory */
    copyAdapterFilesToTestDir() {
        return __awaiter(this, void 0, void 0, function* () {
            debug("Copying adapter files to test directory...");
            // Make sure the target dir exists and is empty
            yield fs_extra_1.remove(this.testAdapterDir);
            yield fs_extra_1.ensureDir(this.testAdapterDir);
            // fs-extra doesn't allow copying a folder into itself, so we need to enum all files/directories to copy
            const filesToCopy = (yield fs_extra_1.readdir(this.adapterDir))
                // filter out unwanted files
                .filter(file => {
                // Don't copy dotfiles
                if (/^\./.test(file))
                    return false;
                // Don't copy node_modules
                if (file === "node_modules")
                    return false;
                // Don't copy the test directory
                if (path.resolve(this.adapterDir, file) === this.testDir)
                    return false;
                // Copy everything else
                return true;
            });
            // And copy them one-by-one
            for (const file of filesToCopy) {
                yield fs_extra_1.copy(path.resolve(this.adapterDir, file), path.resolve(this.testAdapterDir, file));
            }
            debug("Saving the adapter in package.json");
            const packageJsonPath = path.join(this.testDir, "package.json");
            const packageJson = yield fs_extra_1.readJSON(packageJsonPath);
            if (packageJson && packageJson.dependencies) {
                const relativeDir = path
                    .relative(this.testDir, this.testAdapterDir)
                    .replace("\\", "/");
                packageJson.dependencies[this.adapterFullName] = `file:${relativeDir}`;
                yield fs_extra_1.writeJSON(packageJsonPath, packageJson, { spaces: 2 });
                debug("  => done!");
            }
            else {
                debug("  => package.json or -dependencies undefined!");
            }
        });
    }
    /**
     * Adds an instance for an already installed adapter in the test directory
     */
    addAdapterInstance() {
        return __awaiter(this, void 0, void 0, function* () {
            debug("Adding adapter instance...");
            // execute iobroker add <adapter> -- This also installs missing dependencies
            const addResult = yield executeCommand_1.executeCommand("node", [`${this.appName}.js`, "add", this.adapterName, "--enabled", "false"], {
                cwd: this.testControllerDir,
                stdout: "ignore",
            });
            if (addResult.exitCode !== 0)
                throw new Error(`Adding the adapter instance failed!`);
            debug("  => done!");
        });
    }
    deleteOldInstances() {
        return __awaiter(this, void 0, void 0, function* () {
            debug("Removing old adapter instances...");
            const { objects, states } = yield this.dbConnection.readDB();
            const instanceRegex = new RegExp(`^system\\.adapter\\.${this.adapterName}\\.\\d+`);
            const instanceObjsRegex = new RegExp(`^${this.adapterName}\\.\\d+\.`);
            const belongsToAdapter = (id) => {
                return instanceRegex.test(id)
                    || instanceObjsRegex.test(id)
                    || id === this.adapterName
                    || id === `${this.adapterName}.admin`;
            };
            if (objects) {
                for (const id of Object.keys(objects)) {
                    if (belongsToAdapter(id))
                        delete objects[id];
                }
            }
            if (states) {
                for (const id of Object.keys(states)) {
                    if (belongsToAdapter(id))
                        delete states[id];
                }
            }
            yield this.dbConnection.writeDB(objects, states);
        });
    }
}
exports.AdapterSetup = AdapterSetup;
