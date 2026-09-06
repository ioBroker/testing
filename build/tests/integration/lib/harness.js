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
exports.TestHarness = void 0;
exports.parseAdapterLogLine = parseAdapterLogLine;
const async_1 = require("alcalzone-shared/async");
const objects_1 = require("alcalzone-shared/objects");
const node_child_process_1 = require("node:child_process");
const debug_1 = __importDefault(require("debug"));
const node_events_1 = require("node:events");
const path = __importStar(require("node:path"));
const adapterTools_1 = require("../../../lib/adapterTools");
const tools_1 = require("./tools");
const debug = (0, debug_1.default)('testing:integration:TestHarness');
const isWindows = /^win/.test(process.platform);
const logLevels = ['silly', 'debug', 'info', 'warn', 'error'];
/** Matches the color codes the adapter logger adds to the console output */
// eslint-disable-next-line no-control-regex
const ansiRegex = /\x1B\[\d+m/g;
/** Matches `2023-11-08 13:31:57.123  - info: my-adapter.0 (1234) The message` */
const logLineRegex = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+-\s+(\w+):\s+([\s\S]*)$/;
/** Matches the `my-adapter.0 (1234) ` prefix the adapter logger prepends to each message */
const logSourceRegex = /^(\S+\.\d+)(?: \(\d+\))? (.*)$/;
/**
 * Parses a line of the adapter output into a structured log message.
 * Lines that are not in the ioBroker log format (e.g. plain `console.log` output)
 * are returned as `info` messages.
 *
 * @param line A single line of the adapter's stdout/stderr
 */
function parseAdapterLogLine(line) {
    const raw = line.replace(ansiRegex, '').trimEnd();
    const match = logLineRegex.exec(raw);
    const level = match?.[2].toLowerCase();
    if (!match || !level || !logLevels.includes(level)) {
        // Not an ioBroker log line, e.g. plain console output or a stack trace
        return { level: 'info', timestamp: new Date(), from: undefined, message: raw, raw };
    }
    const sourceMatch = logSourceRegex.exec(match[3]);
    return {
        level,
        timestamp: new Date(match[1]),
        from: sourceMatch?.[1],
        message: sourceMatch ? sourceMatch[2] : match[3],
        raw,
    };
}
const fromAdapterID = 'system.adapter.test.0';
/**
 * Encrypts or decrypts a value with the given secret. This is the same symmetric algorithm
 * the JS-Controller uses for the `native` properties listed in `encryptedNative`,
 * so applying it twice returns the original value.
 *
 * @param secret The secret from the `system.config` object
 * @param value The value to encrypt or decrypt
 */
function encryptDecrypt(secret, value) {
    let result = '';
    for (let i = 0; i < value.length; ++i) {
        result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}
/**
 * The test harness capsules the execution of the JS-Controller and the adapter instance and monitors their status.
 * Use it in every test to start a fresh adapter instance
 */
class TestHarness extends node_events_1.EventEmitter {
    adapterDir;
    testDir;
    dbConnection;
    /**
     * @param adapterDir The root directory of the adapter
     * @param testDir The directory the integration tests are executed in
     */
    constructor(adapterDir, testDir, dbConnection) {
        super();
        this.adapterDir = adapterDir;
        this.testDir = testDir;
        this.dbConnection = dbConnection;
        debug('Creating instance');
        this.adapterName = (0, adapterTools_1.getAdapterName)(this.adapterDir);
        this.appName = (0, adapterTools_1.getAppName)(adapterDir);
        this.testControllerDir = (0, tools_1.getTestControllerDir)(this.appName, testDir);
        this.testAdapterDir = (0, tools_1.getTestAdapterDir)(this.adapterDir, testDir);
        debug(`  directories:`);
        debug(`    controller: ${this.testControllerDir}`);
        debug(`    adapter:    ${this.testAdapterDir}`);
        debug(`  appName:           ${this.appName}`);
        debug(`  adapterName:       ${this.adapterName}`);
        dbConnection.on('objectChange', (id, obj) => {
            this.emit('objectChange', id, obj);
        });
        dbConnection.on('stateChange', (id, state) => {
            this.emit('stateChange', id, state);
        });
    }
    adapterName;
    appName;
    testControllerDir;
    testAdapterDir;
    /** Gives direct access to the Objects DB */
    get objects() {
        if (!this.dbConnection.objectsClient) {
            throw new Error('Objects DB is not running');
        }
        return this.dbConnection.objectsClient;
    }
    /** Gives direct access to the States DB */
    get states() {
        if (!this.dbConnection.statesClient) {
            throw new Error('States DB is not running');
        }
        return this.dbConnection.statesClient;
    }
    _adapterProcess;
    /** The process the adapter is running in */
    get adapterProcess() {
        return this._adapterProcess;
    }
    _adapterExit;
    /** Contains the adapter exit code or signal if it was terminated unexpectedly */
    get adapterExit() {
        return this._adapterExit;
    }
    /** Checks if the controller instance is running */
    isControllerRunning() {
        // The "controller instance" is just the databases, so if they are running,
        // the "controller" is.
        return this.dbConnection.isRunning;
    }
    /** Starts the controller instance by creating the databases */
    async startController() {
        await this.dbConnection.start();
    }
    /** Stops the controller instance (and the adapter if it is running) */
    async stopController() {
        if (!this.isControllerRunning()) {
            return;
        }
        if (!this.didAdapterStop()) {
            debug('Stopping adapter instance...');
            // Give the adapter time to stop (as long as configured in the io-package.json)
            let stopTimeout;
            try {
                stopTimeout = (await this.dbConnection.getObject(`system.adapter.${this.adapterName}.0`))
                    .common.stopTimeout;
                stopTimeout += 1000;
            }
            catch {
                // ignore
            }
            stopTimeout ||= 5000; // default 5s
            debug(`  => giving it ${stopTimeout}ms to terminate`);
            await Promise.race([this.stopAdapter(), (0, async_1.wait)(stopTimeout)]);
            if (this.isAdapterRunning()) {
                debug('Adapter did not terminate, killing it');
                this._adapterProcess.kill('SIGKILL');
            }
            else {
                debug('Adapter terminated');
            }
        }
        else {
            debug('Adapter failed to start - no need to terminate!');
        }
        await this.dbConnection.stop();
    }
    /**
     * Starts the adapter in a separate process and monitors its status
     *
     * @param env Additional environment variables to set
     */
    async startAdapter(env = {}) {
        if (this.isAdapterRunning()) {
            throw new Error('The adapter is already running!');
        }
        else if (this.didAdapterStop()) {
            throw new Error('This test harness has already been used. Please create a new one for each test!');
        }
        const mainFileAbsolute = await (0, adapterTools_1.locateAdapterMainFile)(this.testAdapterDir);
        const mainFileRelative = path.relative(this.testAdapterDir, mainFileAbsolute);
        const onClose = (code, signal) => {
            this._adapterProcess.removeAllListeners();
            this.flushAdapterOutput();
            this._adapterExit = code != undefined ? code : signal;
            this.emit('failed', this._adapterExit);
        };
        // Determine if we need to use esbuild-register for TypeScript files
        const isTypeScript = mainFileAbsolute.endsWith('.ts');
        const command = isWindows ? 'node.exe' : 'node';
        const args = isTypeScript
            ? ['-r', '@alcalzone/esbuild-register', mainFileRelative, '--console']
            : [mainFileRelative, '--console'];
        this._adapterProcess = (0, node_child_process_1.spawn)(command, args, {
            cwd: this.testAdapterDir,
            // stdout and stderr are piped, so the log messages can be captured
            stdio: ['inherit', 'pipe', 'pipe'],
            env: { ...process.env, ...env },
        })
            .on('close', onClose)
            .on('exit', onClose);
        this._adapterProcess.stdout?.on('data', (chunk) => this.handleAdapterOutput(chunk, 'stdout'));
        this._adapterProcess.stderr?.on('data', (chunk) => this.handleAdapterOutput(chunk, 'stderr'));
    }
    /**
     * Starts the adapter in a separate process and resolves after it has started
     *
     * @param waitForConnection By default, the test will wait for the adapter's `alive` state to become true. Set this to `true` to wait for the `info.connection` state instead.
     * @param env Additional environment variables to set
     */
    async startAdapterAndWait(waitForConnection = false, env = {}) {
        return new Promise((resolve, reject) => {
            const waitForStateId = waitForConnection
                ? `${this.adapterName}.0.info.connection`
                : `system.adapter.${this.adapterName}.0.alive`;
            void this.on('stateChange', (id, state) => {
                if (id === waitForStateId && state && state.val === true) {
                    resolve();
                }
            })
                .on('failed', code => {
                reject(new Error(`The adapter startup was interrupted unexpectedly with ${typeof code === 'number' ? 'code' : 'signal'} ${code}`));
            })
                .startAdapter(env);
        });
    }
    /** Tests if the adapter process is still running */
    isAdapterRunning() {
        return !!this._adapterProcess;
    }
    /** Tests if the adapter process has already exited */
    didAdapterStop() {
        return this._adapterExit != undefined;
    }
    /** Stops the adapter process */
    stopAdapter() {
        if (!this.isAdapterRunning()) {
            return;
        }
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve) => {
            const onClose = (code, signal) => {
                if (!this._adapterProcess) {
                    return;
                }
                this._adapterProcess.removeAllListeners();
                this.flushAdapterOutput();
                this._adapterExit = code != undefined ? code : signal;
                this._adapterProcess = undefined;
                debug('Adapter process terminated:');
                debug(`  Code:   ${code}`);
                debug(`  Signal: ${signal}`);
                resolve();
            };
            this._adapterProcess.removeAllListeners().on('close', onClose).on('exit', onClose);
            // Tell adapter to stop
            try {
                await this.dbConnection.setState(`system.adapter.${this.adapterName}.0.sigKill`, {
                    val: -1,
                    from: 'system.host.testing',
                });
            }
            catch {
                // DB connection may be closed already, kill the process
                this._adapterProcess?.kill('SIGTERM');
            }
        });
    }
    /**
     * Updates the adapter config. The changes can be a subset of the target object.
     * The `native` properties that are listed in the instance object's `encryptedNative`
     * are encrypted automatically, so they can be passed in plain text.
     */
    async changeAdapterConfig(adapterName, changes) {
        const adapterInstanceId = `system.adapter.${adapterName}.0`;
        const obj = await this.dbConnection.getObject(adapterInstanceId);
        if (obj) {
            (0, objects_1.extend)(obj, await this.encryptNativeChanges(obj, changes));
            await this.dbConnection.setObject(adapterInstanceId, obj);
        }
    }
    /**
     * Reads the config of an adapter instance. The `native` properties that are listed in the
     * instance object's `encryptedNative` are decrypted automatically, so they are returned in plain text.
     *
     * @param adapterName The name of the adapter. Defaults to the adapter under test.
     */
    async getAdapterConfig(adapterName = this.adapterName) {
        const obj = await this.dbConnection.getObject(`system.adapter.${adapterName}.0`);
        if (!obj) {
            return null;
        }
        const fields = this.getEncryptedFields(obj, obj.native);
        if (fields.length) {
            const secret = await this.getSystemSecret();
            const native = { ...obj.native };
            for (const field of fields) {
                native[field] = encryptDecrypt(secret, native[field]);
            }
            debug(`Decrypted the following config fields: ${fields.join(', ')}`);
            return { ...obj, native };
        }
        return obj;
    }
    /**
     * Returns the names of all `native` properties in the given config that must be en-/decrypted
     */
    getEncryptedFields(obj, native) {
        if (!native || !obj.encryptedNative?.length) {
            return [];
        }
        // Only strings can be en-/decrypted, everything else is left untouched
        return obj.encryptedNative.filter(field => typeof native[field] === 'string');
    }
    /**
     * Encrypts all `native` properties of the given changes that are listed in the instance
     * object's `encryptedNative`. Returns the changes to apply - the passed object is not modified.
     */
    async encryptNativeChanges(obj, changes) {
        const fields = this.getEncryptedFields(obj, changes.native);
        if (!fields.length) {
            return changes;
        }
        const secret = await this.getSystemSecret();
        const native = { ...changes.native };
        for (const field of fields) {
            native[field] = encryptDecrypt(secret, native[field]);
        }
        debug(`Encrypted the following config fields: ${fields.join(', ')}`);
        return { ...changes, native };
    }
    _systemSecret;
    /**
     * Reads the secret from the `system.config` object. The secret is cached after the first read.
     */
    async getSystemSecret() {
        if (this._systemSecret === undefined) {
            const systemConfig = await this.dbConnection.getObject('system.config');
            const secret = systemConfig?.native?.secret;
            if (typeof secret !== 'string' || !secret) {
                throw new Error('Could not read the secret from the object "system.config"!');
            }
            this._systemSecret = secret;
        }
        return this._systemSecret;
    }
    /**
     * Encrypts a value the same way the JS-Controller does for `encryptedNative` properties
     */
    async encryptValue(value) {
        return encryptDecrypt(await this.getSystemSecret(), value);
    }
    /**
     * Decrypts a value that was encrypted for an `encryptedNative` property
     */
    async decryptValue(value) {
        return encryptDecrypt(await this.getSystemSecret(), value);
    }
    getAdapterExecutionMode() {
        return (0, adapterTools_1.getAdapterExecutionMode)(this.testAdapterDir);
    }
    /** Enables the sendTo method */
    async enableSendTo() {
        await this.dbConnection.setObject(fromAdapterID, {
            type: 'instance',
            common: {},
            native: {},
            instanceObjects: [],
            objects: [],
        });
        this.dbConnection.subscribeMessage(fromAdapterID);
    }
    sendToID = 1;
    /** Sends a message to an adapter instance */
    sendTo(target, command, message, callback) {
        const stateChangedHandler = (id, state) => {
            if (id === `messagebox.${fromAdapterID}`) {
                callback(state.message);
                this.removeListener('stateChange', stateChangedHandler);
            }
        };
        this.addListener('stateChange', stateChangedHandler);
        this.dbConnection.pushMessage(`system.adapter.${target}`, {
            command: command,
            message: message,
            from: fromAdapterID,
            callback: {
                message: message,
                id: this.sendToID++,
                ack: false,
                time: Date.now(),
            },
        }, (err, id) => console.log(`published message ${id}`));
    }
    /** The log messages of the adapter under test */
    _logs = [];
    /** The incomplete last line of each output stream, waiting for the rest to arrive */
    _outputBuffer = { stdout: '', stderr: '' };
    /**
     * Handles a chunk of the adapter's output. Because a chunk may end in the middle of a line,
     * the incomplete rest is buffered until the remainder arrives.
     *
     * @param chunk The received chunk
     * @param stream Which of the adapter's output streams the chunk was received on
     */
    handleAdapterOutput(chunk, stream) {
        const lines = (this._outputBuffer[stream] + chunk.toString()).split('\n');
        // The last entry is either an incomplete line or empty - keep it for the next chunk
        this._outputBuffer[stream] = lines.pop() ?? '';
        for (const line of lines) {
            this.handleAdapterOutputLine(line, stream);
        }
    }
    /** Prints a line of the adapter's output and remembers it as a log message */
    handleAdapterOutputLine(line, stream) {
        // Forward the output, so it stays visible while the tests are running
        process[stream].write(`${line}\n`);
        if (line.trim()) {
            this._logs.push(parseAdapterLogLine(line));
        }
    }
    /** Handles the incomplete lines that were left over when the adapter exited */
    flushAdapterOutput() {
        for (const stream of ['stdout', 'stderr']) {
            const rest = this._outputBuffer[stream];
            this._outputBuffer[stream] = '';
            if (rest) {
                this.handleAdapterOutputLine(rest, stream);
            }
        }
    }
    /**
     * Returns the log messages the adapter has printed so far
     *
     * @param level If given, only the messages with this log level are returned
     */
    getLogs(level) {
        return level ? this._logs.filter(log => log.level === level) : [...this._logs];
    }
    /** Forgets all log messages that were captured so far */
    clearLogs() {
        this._logs = [];
    }
    /**
     * Tests if the adapter has logged a message matching the given pattern
     *
     * @param pattern A RegExp or a string that must be contained in the message
     * @param level If given, only the messages with this log level are checked
     */
    hasLog(pattern, level) {
        return this.getLogs(level).some(log => typeof pattern === 'string' ? log.message.includes(pattern) : pattern.test(log.message));
    }
}
exports.TestHarness = TestHarness;
