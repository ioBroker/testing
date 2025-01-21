import { SpawnOptions, spawn } from 'child_process';

const isWindows = /^win/.test(process.platform);

export interface ExecuteCommandOptions {
    /** Whether the executed command should be logged to the stdout. Default: false */
    logCommandExecution: boolean;
    /** The directory to execute the command in */
    cwd: string;
    /** Where to redirect the stdin. Default: process.stdin */
    stdin: NodeJS.ReadStream;
    /** A write stream to redirect the stdout, "ignore" to ignore it or "pipe" to return it as a string. Default: process.stdout */
    stdout: NodeJS.WriteStream | 'pipe' | 'ignore';
    /** A write stream to redirect the stderr, "ignore" to ignore it or "pipe" to return it as a string. Default: process.stderr */
    stderr: NodeJS.WriteStream | 'pipe' | 'ignore';
}

export interface ExecuteCommandResult {
    /** The exit code of the spawned process */
    exitCode?: number;
    /** The signal the process received before termination */
    signal?: string;
    /** If options.stdout was set to "buffer", this contains the stdout of the spawned process */
    stdout?: string;
    /** If options.stderr was set to "buffer", this contains the stderr of the spawned process */
    stderr?: string;
}

export function executeCommand(
    command: string,
    options?: Partial<ExecuteCommandOptions>,
): Promise<ExecuteCommandResult>;
/**
 * Executes a command and returns the exit code and (if requested) the stdout
 * @param command The command to execute
 * @param args The command line arguments for the command
 * @param options (optional) Some options for the command execution
 */
export function executeCommand(
    command: string,
    args: string[],
    options?: Partial<ExecuteCommandOptions>,
): Promise<ExecuteCommandResult>;
export function executeCommand(
    command: string,
    argsOrOptions?: string[] | Partial<ExecuteCommandOptions>,
    options?: Partial<ExecuteCommandOptions>,
): Promise<ExecuteCommandResult> {
    return new Promise(resolve => {
        let args: string[] | undefined;
        if (Array.isArray(argsOrOptions)) {
            args = argsOrOptions as string[];
        } else if (argsOrOptions && typeof argsOrOptions === 'object') {
            // no args were given
            options = argsOrOptions;
        }
        if (options == null) options = {};
        if (args == null) args = [];

        const spawnOptions: SpawnOptions = {
            stdio: [options.stdin || process.stdin, options.stdout || process.stdout, options.stderr || process.stderr],
            windowsHide: true,
        };
        if (options.cwd != null) spawnOptions.cwd = options.cwd;

        // Fix npm / node executable paths on Windows
        if (isWindows) {
            if (command === 'npm') {
                command += '.cmd';
                // Needed since Node.js v18.20.2 and v20.12.2
                // https://github.com/nodejs/node/releases/tag/v18.20.2
                spawnOptions.shell = true;
            } else if (command === 'node') {
                command += '.exe';
            }
        }

        if (options.logCommandExecution == null) options.logCommandExecution = false;
        if (options.logCommandExecution) {
            console.log('executing: ' + `${command} ${args.join(' ')}`);
        }

        // Now execute the npm process and avoid throwing errors
        try {
            let bufferedStdout: string | undefined;
            let bufferedStderr: string | undefined;
            const cmd = spawn(command, args, spawnOptions).on('close', (code, signal) => {
                resolve({
                    exitCode: code ?? undefined,
                    signal: signal ?? undefined,
                    stdout: bufferedStdout,
                    stderr: bufferedStderr,
                });
            });
            // Capture stdout/stderr if requested
            if (options.stdout === 'pipe') {
                bufferedStdout = '';
                cmd.stdout!.on('data', (chunk: Buffer | string) => {
                    if (Buffer.isBuffer(chunk)) chunk = chunk.toString('utf8');
                    bufferedStdout! += chunk;
                });
            }
            if (options.stderr === 'pipe') {
                bufferedStderr = '';
                cmd.stderr!.on('data', (chunk: Buffer | string) => {
                    if (Buffer.isBuffer(chunk)) chunk = chunk.toString('utf8');
                    bufferedStderr! += chunk;
                });
            }
        } catch {
            // doesn't matter, we return the exit code in the "close" handler
        }
    });
}
