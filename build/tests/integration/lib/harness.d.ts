import { type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type { DBConnection } from './dbConnection';
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
/**
 * Parses a line of the adapter output into a structured log message.
 * Lines that are not in the ioBroker log format (e.g. plain `console.log` output)
 * are returned as `info` messages.
 *
 * @param line A single line of the adapter's stdout/stderr
 */
export declare function parseAdapterLogLine(line: string): AdapterLog;
export interface TestHarness {
    on(event: 'objectChange', handler: ioBroker.ObjectChangeHandler): this;
    on(event: 'stateChange', handler: ioBroker.StateChangeHandler): this;
    on(event: 'failed', handler: (codeOrSignal: number | string) => void): this;
}
/**
 * The test harness capsules the execution of the JS-Controller and the adapter instance and monitors their status.
 * Use it in every test to start a fresh adapter instance
 */
export declare class TestHarness extends EventEmitter {
    private adapterDir;
    private testDir;
    private dbConnection;
    /**
     * @param adapterDir The root directory of the adapter
     * @param testDir The directory the integration tests are executed in
     */
    constructor(adapterDir: string, testDir: string, dbConnection: DBConnection);
    readonly adapterName: string;
    private appName;
    private testControllerDir;
    private testAdapterDir;
    /** Gives direct access to the Objects DB */
    get objects(): any;
    /** Gives direct access to the States DB */
    get states(): any;
    private _adapterProcess;
    /** The process the adapter is running in */
    get adapterProcess(): ChildProcess | undefined;
    private _adapterExit;
    /** Contains the adapter exit code or signal if it was terminated unexpectedly */
    get adapterExit(): number | string | undefined;
    /** Checks if the controller instance is running */
    isControllerRunning(): boolean;
    /** Starts the controller instance by creating the databases */
    startController(): Promise<void>;
    /** Stops the controller instance (and the adapter if it is running) */
    stopController(): Promise<void>;
    /**
     * Starts the adapter in a separate process and monitors its status
     *
     * @param env Additional environment variables to set
     */
    startAdapter(env?: NodeJS.ProcessEnv): Promise<void>;
    /**
     * Starts the adapter in a separate process and resolves after it has started
     *
     * @param waitForConnection By default, the test will wait for the adapter's `alive` state to become true. Set this to `true` to wait for the `info.connection` state instead.
     * @param env Additional environment variables to set
     */
    startAdapterAndWait(waitForConnection?: boolean, env?: NodeJS.ProcessEnv): Promise<void>;
    /** Tests if the adapter process is still running */
    isAdapterRunning(): boolean;
    /** Tests if the adapter process has already exited */
    didAdapterStop(): boolean;
    /** Stops the adapter process */
    stopAdapter(): Promise<void> | undefined;
    /**
     * Updates the adapter config. The changes can be a subset of the target object.
     * The `native` properties that are listed in the instance object's `encryptedNative`
     * are encrypted automatically, so they can be passed in plain text.
     */
    changeAdapterConfig(adapterName: string, changes: Record<string, any>): Promise<void>;
    /**
     * Reads the config of an adapter instance. The `native` properties that are listed in the
     * instance object's `encryptedNative` are decrypted automatically, so they are returned in plain text.
     *
     * @param adapterName The name of the adapter. Defaults to the adapter under test.
     */
    getAdapterConfig(adapterName?: string): Promise<ioBroker.InstanceObject | null>;
    /**
     * Returns the names of all `native` properties in the given config that must be en-/decrypted
     */
    private getEncryptedFields;
    /**
     * Encrypts all `native` properties of the given changes that are listed in the instance
     * object's `encryptedNative`. Returns the changes to apply - the passed object is not modified.
     */
    private encryptNativeChanges;
    private _systemSecret;
    /**
     * Reads the secret from the `system.config` object. The secret is cached after the first read.
     */
    private getSystemSecret;
    /**
     * Encrypts a value the same way the JS-Controller does for `encryptedNative` properties
     */
    encryptValue(value: string): Promise<string>;
    /**
     * Decrypts a value that was encrypted for an `encryptedNative` property
     */
    decryptValue(value: string): Promise<string>;
    getAdapterExecutionMode(): ioBroker.AdapterCommon['mode'];
    /** Enables the sendTo method */
    enableSendTo(): Promise<void>;
    private sendToID;
    /** Sends a message to an adapter instance */
    sendTo(target: string, command: string, message: any, callback: ioBroker.MessageCallback): void;
    /** The log messages of the adapter under test */
    private _logs;
    /** The incomplete last line of each output stream, waiting for the rest to arrive */
    private _outputBuffer;
    /**
     * Handles a chunk of the adapter's output. Because a chunk may end in the middle of a line,
     * the incomplete rest is buffered until the remainder arrives.
     *
     * @param chunk The received chunk
     * @param stream Which of the adapter's output streams the chunk was received on
     */
    private handleAdapterOutput;
    /** Prints a line of the adapter's output and remembers it as a log message */
    private handleAdapterOutputLine;
    /** Handles the incomplete lines that were left over when the adapter exited */
    private flushAdapterOutput;
    /**
     * Returns the log messages the adapter has printed so far
     *
     * @param level If given, only the messages with this log level are returned
     */
    getLogs(level?: ioBroker.LogLevel): AdapterLog[];
    /** Forgets all log messages that were captured so far */
    clearLogs(): void;
    /**
     * Tests if the adapter has logged a message matching the given pattern
     *
     * @param pattern A RegExp or a string that must be contained in the message
     * @param level If given, only the messages with this log level are checked
     */
    hasLog(pattern: string | RegExp, level?: ioBroker.LogLevel): boolean;
}
