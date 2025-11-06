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

export interface TestHarness {
    on(event: 'objectChange', handler: ioBroker.ObjectChangeHandler): this;
    on(event: 'stateChange', handler: ioBroker.StateChangeHandler): this;
    on(event: 'failed', handler: (codeOrSignal: number | string) => void): this;
}

const fromAdapterID = 'system.adapter.test.0';

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
            this._adapterExit = code != undefined ? code : signal;
            this.emit('failed', this._adapterExit);
        };

        this._adapterProcess = spawn(isWindows ? 'node.exe' : 'node', [mainFileRelative, '--console'], {
            cwd: this.testAdapterDir,
            stdio: ['inherit', 'inherit', 'inherit'],
            env: { ...process.env, ...env },
        })
            .on('close', onClose)
            .on('exit', onClose);
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
     * Fields listed in encryptedNative will be automatically encrypted.
     */
    public async changeAdapterConfig(adapterName: string, changes: Record<string, any>): Promise<void> {
        const adapterInstanceId = `system.adapter.${adapterName}.0`;
        const obj = await this.dbConnection.getObject(adapterInstanceId);
        if (obj) {
            // Get the encryptedNative fields from the adapter object
            const encryptedNative = obj.encryptedNative || [];

            // If we have native changes and encrypted fields are defined, encrypt them
            if (changes.native && encryptedNative.length > 0) {
                const encryptedFields: string[] = [];

                for (const fieldName of encryptedNative) {
                    if (changes.native[fieldName] !== undefined) {
                        const originalValue = changes.native[fieldName];
                        changes.native[fieldName] = await this.encryptValue(originalValue);
                        encryptedFields.push(fieldName);
                    }
                }

                if (encryptedFields.length > 0) {
                    debug(`Encrypted fields during config change: ${encryptedFields.join(', ')}`);
                }
            }

            extend(obj, changes);
            await this.dbConnection.setObject(adapterInstanceId, obj);
        }
    }

    private _cachedSecret: string | undefined;

    /**
     * Gets the system secret, with caching to prevent duplicate reads
     */
    private async getSystemSecret(): Promise<string> {
        if (this._cachedSecret !== undefined) {
            return this._cachedSecret;
        }

        const systemConfig = await this.dbConnection.getObject('system.config');
        if (!systemConfig || !systemConfig.native || !systemConfig.native.secret) {
            throw new Error('System configuration or secret not found');
        }

        const secret = systemConfig.native.secret as string;
        this._cachedSecret = secret;
        return secret;
    }

    /**
     * Encrypts a value using the system secret
     */
    public async encryptValue(value: string): Promise<string> {
        const secret = await this.getSystemSecret();
        return this.performEncryption(value, secret);
    }

    /**
     * Decrypts a value using the system secret
     */
    public async decryptValue(encryptedValue: string): Promise<string> {
        const secret = await this.getSystemSecret();
        return this.performDecryption(encryptedValue, secret);
    }

    /**
     * Performs XOR encryption/decryption (same operation for both due to XOR properties)
     */
    private performEncryption(value: string, secret: string): string {
        let result = '';
        for (let i = 0; i < value.length; ++i) {
            result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ value.charCodeAt(i));
        }
        return result;
    }

    /**
     * Performs XOR decryption (same operation as encryption due to XOR properties)
     */
    private performDecryption(encryptedValue: string, secret: string): string {
        return this.performEncryption(encryptedValue, secret); // XOR is symmetric
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
}
