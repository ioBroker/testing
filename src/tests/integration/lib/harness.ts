import { wait } from 'alcalzone-shared/async';
import { extend } from 'alcalzone-shared/objects';
import { type ChildProcess, spawn } from 'node:child_process';
import debugModule from 'debug';
import { EventEmitter } from 'node:events';
import * as path from 'node:path';
import { getAdapterExecutionMode, getAdapterName, getAppName, locateAdapterMainFile } from '../../../lib/adapterTools';
import type { DBConnection } from './dbConnection';
import { getTestAdapterDir, getTestControllerDir } from './tools';

const debug = debugModule('testing:integration:TestHarness');

const isWindows = /^win/.test(process.platform);

/** A single log message of the adapter under test */
export interface AdapterLog {
    /** The log level the message was logged with */
    level: ioBroker.LogLevel;
    /** The time the message was logged at */
    timestamp: Date;
    /** The source of the message, e.g. `my-adapter.0`. Undefined if it could not be determined */
    from: string | undefined;
    /** The logged message without timestamp, level and source */
    message: string;
    /** The unparsed log line as it was printed by the adapter */
    raw: string;
}

const logLevels: ioBroker.LogLevel[] = ['silly', 'debug', 'info', 'warn', 'error'];

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
export function parseAdapterLogLine(line: string): AdapterLog {
    const raw = line.replace(ansiRegex, '').trimEnd();
    const match = logLineRegex.exec(raw);
    const level = match?.[2].toLowerCase() as ioBroker.LogLevel | undefined;

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

export interface TestHarness {
    on(event: 'objectChange', handler: ioBroker.ObjectChangeHandler): this;
    on(event: 'stateChange', handler: ioBroker.StateChangeHandler): this;
    on(event: 'failed', handler: (codeOrSignal: number | string) => void): this;
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
function encryptDecrypt(secret: string, value: string): string {
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
export class TestHarness extends EventEmitter {
    /**
     * @param adapterDir The root directory of the adapter
     * @param testDir The directory the integration tests are executed in
     */
    public constructor(
        private adapterDir: string,
        private testDir: string,
        private dbConnection: DBConnection,
    ) {
        super();

        debug('Creating instance');
        this.adapterName = getAdapterName(this.adapterDir);
        this.appName = getAppName(adapterDir);

        this.testControllerDir = getTestControllerDir(this.appName, testDir);
        this.testAdapterDir = getTestAdapterDir(this.adapterDir, testDir);

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

    public readonly adapterName: string;
    private appName: string;
    private testControllerDir: string;
    private testAdapterDir: string;

    /** Gives direct access to the Objects DB */
    public get objects(): any {
        if (!this.dbConnection.objectsClient) {
            throw new Error('Objects DB is not running');
        }
        return this.dbConnection.objectsClient;
    }

    /** Gives direct access to the States DB */
    public get states(): any {
        if (!this.dbConnection.statesClient) {
            throw new Error('States DB is not running');
        }
        return this.dbConnection.statesClient;
    }

    private _adapterProcess: ChildProcess | undefined;
    /** The process the adapter is running in */
    public get adapterProcess(): ChildProcess | undefined {
        return this._adapterProcess;
    }

    private _adapterExit: number | string | undefined;
    /** Contains the adapter exit code or signal if it was terminated unexpectedly */
    public get adapterExit(): number | string | undefined {
        return this._adapterExit;
    }

    /** Checks if the controller instance is running */
    public isControllerRunning(): boolean {
        // The "controller instance" is just the databases, so if they are running,
        // the "controller" is.
        return this.dbConnection.isRunning;
    }

    /** Starts the controller instance by creating the databases */
    public async startController(): Promise<void> {
        await this.dbConnection.start();
    }

    /** Stops the controller instance (and the adapter if it is running) */
    public async stopController(): Promise<void> {
        if (!this.isControllerRunning()) {
            return;
        }

        if (!this.didAdapterStop()) {
            debug('Stopping adapter instance...');
            // Give the adapter time to stop (as long as configured in the io-package.json)
            let stopTimeout: number;
            try {
                stopTimeout = ((await this.dbConnection.getObject(`system.adapter.${this.adapterName}.0`)) as any)
                    .common.stopTimeout;
                stopTimeout += 1000;
            } catch {
                // ignore
            }
            stopTimeout ||= 5000; // default 5s
            debug(`  => giving it ${stopTimeout}ms to terminate`);
            await Promise.race([this.stopAdapter(), wait(stopTimeout)]);

            if (this.isAdapterRunning()) {
                debug('Adapter did not terminate, killing it');
                this._adapterProcess!.kill('SIGKILL');
            } else {
                debug('Adapter terminated');
            }
        } else {
            debug('Adapter failed to start - no need to terminate!');
        }

        await this.dbConnection.stop();
    }

    /**
     * Starts the adapter in a separate process and monitors its status
     *
     * @param env Additional environment variables to set
     */
    public async startAdapter(env: NodeJS.ProcessEnv = {}): Promise<void> {
        if (this.isAdapterRunning()) {
            throw new Error('The adapter is already running!');
        } else if (this.didAdapterStop()) {
            throw new Error('This test harness has already been used. Please create a new one for each test!');
        }

        const mainFileAbsolute = await locateAdapterMainFile(this.testAdapterDir);
        const mainFileRelative = path.relative(this.testAdapterDir, mainFileAbsolute);

        const onClose = (code: number | undefined, signal: string): void => {
            this._adapterProcess!.removeAllListeners();
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

        this._adapterProcess = spawn(command, args, {
            cwd: this.testAdapterDir,
            // stdout and stderr are piped, so the log messages can be captured
            stdio: ['inherit', 'pipe', 'pipe'],
            env: { ...process.env, ...env },
        })
            .on('close', onClose)
            .on('exit', onClose);

        this._adapterProcess.stdout?.on('data', (chunk: Buffer) => this.handleAdapterOutput(chunk, 'stdout'));
        this._adapterProcess.stderr?.on('data', (chunk: Buffer) => this.handleAdapterOutput(chunk, 'stderr'));
    }

    /**
     * Starts the adapter in a separate process and resolves after it has started
     *
     * @param waitForConnection By default, the test will wait for the adapter's `alive` state to become true. Set this to `true` to wait for the `info.connection` state instead.
     * @param env Additional environment variables to set
     */
    public async startAdapterAndWait(waitForConnection: boolean = false, env: NodeJS.ProcessEnv = {}): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const waitForStateId = waitForConnection
                ? `${this.adapterName}.0.info.connection`
                : `system.adapter.${this.adapterName}.0.alive`;
            void this.on('stateChange', (id, state) => {
                if (id === waitForStateId && state && state.val === true) {
                    resolve();
                }
            })
                .on('failed', code => {
                    reject(
                        new Error(
                            `The adapter startup was interrupted unexpectedly with ${
                                typeof code === 'number' ? 'code' : 'signal'
                            } ${code}`,
                        ),
                    );
                })
                .startAdapter(env);
        });
    }

    /** Tests if the adapter process is still running */
    public isAdapterRunning(): boolean {
        return !!this._adapterProcess;
    }

    /** Tests if the adapter process has already exited */
    public didAdapterStop(): boolean {
        return this._adapterExit != undefined;
    }

    /** Stops the adapter process */
    public stopAdapter(): Promise<void> | undefined {
        if (!this.isAdapterRunning()) {
            return;
        }

        // eslint-disable-next-line no-async-promise-executor
        return new Promise<void>(async resolve => {
            const onClose = (code: number | undefined, signal: string): void => {
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

            this._adapterProcess!.removeAllListeners().on('close', onClose).on('exit', onClose);

            // Tell adapter to stop
            try {
                await this.dbConnection.setState(`system.adapter.${this.adapterName}.0.sigKill`, {
                    val: -1,
                    from: 'system.host.testing',
                });
            } catch {
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
    public async changeAdapterConfig(adapterName: string, changes: Record<string, any>): Promise<void> {
        const adapterInstanceId = `system.adapter.${adapterName}.0`;
        const obj = await this.dbConnection.getObject(adapterInstanceId);
        if (obj) {
            extend(obj, await this.encryptNativeChanges(obj as ioBroker.InstanceObject, changes));
            await this.dbConnection.setObject(adapterInstanceId, obj);
        }
    }

    /**
     * Reads the config of an adapter instance. The `native` properties that are listed in the
     * instance object's `encryptedNative` are decrypted automatically, so they are returned in plain text.
     *
     * @param adapterName The name of the adapter. Defaults to the adapter under test.
     */
    public async getAdapterConfig(adapterName: string = this.adapterName): Promise<ioBroker.InstanceObject | null> {
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
    private getEncryptedFields(obj: ioBroker.InstanceObject, native: Record<string, any> | undefined): string[] {
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
    private async encryptNativeChanges(
        obj: ioBroker.InstanceObject,
        changes: Record<string, any>,
    ): Promise<Record<string, any>> {
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

    private _systemSecret: string | undefined;

    /**
     * Reads the secret from the `system.config` object. The secret is cached after the first read.
     */
    private async getSystemSecret(): Promise<string> {
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
    public async encryptValue(value: string): Promise<string> {
        return encryptDecrypt(await this.getSystemSecret(), value);
    }

    /**
     * Decrypts a value that was encrypted for an `encryptedNative` property
     */
    public async decryptValue(value: string): Promise<string> {
        return encryptDecrypt(await this.getSystemSecret(), value);
    }

    public getAdapterExecutionMode(): ioBroker.AdapterCommon['mode'] {
        return getAdapterExecutionMode(this.testAdapterDir);
    }

    /** Enables the sendTo method */
    public async enableSendTo(): Promise<void> {
        await this.dbConnection.setObject(fromAdapterID, {
            type: 'instance',
            common: {} as ioBroker.InstanceCommon,
            native: {},
            instanceObjects: [],
            objects: [],
        });

        this.dbConnection.subscribeMessage(fromAdapterID);
    }

    private sendToID = 1;

    /** Sends a message to an adapter instance */
    public sendTo(target: string, command: string, message: any, callback: ioBroker.MessageCallback): void {
        const stateChangedHandler: ioBroker.StateChangeHandler = (id, state) => {
            if (id === `messagebox.${fromAdapterID}`) {
                callback((state as any).message);
                this.removeListener('stateChange', stateChangedHandler);
            }
        };
        this.addListener('stateChange', stateChangedHandler);

        this.dbConnection.pushMessage(
            `system.adapter.${target}`,
            {
                command: command,
                message: message,
                from: fromAdapterID,
                callback: {
                    message: message,
                    id: this.sendToID++,
                    ack: false,
                    time: Date.now(),
                },
            },
            (err: any, id: any) => console.log(`published message ${id}`),
        );
    }

    /** The log messages of the adapter under test */
    private _logs: AdapterLog[] = [];
    /** The incomplete last line of each output stream, waiting for the rest to arrive */
    private _outputBuffer: Record<'stdout' | 'stderr', string> = { stdout: '', stderr: '' };

    /**
     * Handles a chunk of the adapter's output. Because a chunk may end in the middle of a line,
     * the incomplete rest is buffered until the remainder arrives.
     *
     * @param chunk The received chunk
     * @param stream Which of the adapter's output streams the chunk was received on
     */
    private handleAdapterOutput(chunk: Buffer | string, stream: 'stdout' | 'stderr'): void {
        const lines = (this._outputBuffer[stream] + chunk.toString()).split('\n');
        // The last entry is either an incomplete line or empty - keep it for the next chunk
        this._outputBuffer[stream] = lines.pop() ?? '';
        for (const line of lines) {
            this.handleAdapterOutputLine(line, stream);
        }
    }

    /** Prints a line of the adapter's output and remembers it as a log message */
    private handleAdapterOutputLine(line: string, stream: 'stdout' | 'stderr'): void {
        // Forward the output, so it stays visible while the tests are running
        process[stream].write(`${line}\n`);
        if (line.trim()) {
            this._logs.push(parseAdapterLogLine(line));
        }
    }

    /** Handles the incomplete lines that were left over when the adapter exited */
    private flushAdapterOutput(): void {
        for (const stream of ['stdout', 'stderr'] as const) {
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
    public getLogs(level?: ioBroker.LogLevel): AdapterLog[] {
        return level ? this._logs.filter(log => log.level === level) : [...this._logs];
    }

    /** Forgets all log messages that were captured so far */
    public clearLogs(): void {
        this._logs = [];
    }

    /**
     * Tests if the adapter has logged a message matching the given pattern
     *
     * @param pattern A RegExp or a string that must be contained in the message
     * @param level If given, only the messages with this log level are checked
     */
    public hasLog(pattern: string | RegExp, level?: ioBroker.LogLevel): boolean {
        return this.getLogs(level).some(log =>
            typeof pattern === 'string' ? log.message.includes(pattern) : pattern.test(log.message),
        );
    }
}
