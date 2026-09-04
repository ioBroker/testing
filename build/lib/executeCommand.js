"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeCommand = executeCommand;
const node_child_process_1 = require("node:child_process");
const isWindows = /^win/.test(process.platform);
/**
 * Executes a command and returns the exit code and (if requested) the stdout
 *
 * @param command The command to execute
 * @param argsOrOptions The command line arguments for the command
 * @param options (optional) Some options for the command execution
 */
function executeCommand(command, argsOrOptions, options) {
    return new Promise(resolve => {
        let args;
        if (Array.isArray(argsOrOptions)) {
            args = argsOrOptions;
        }
        else if (argsOrOptions && typeof argsOrOptions === 'object') {
            // no args were given
            options = argsOrOptions;
        }
        if (options == null) {
            options = {};
        }
        if (args == null) {
            args = [];
        }
        const spawnOptions = {
            stdio: [options.stdin || process.stdin, options.stdout || process.stdout, options.stderr || process.stderr],
            windowsHide: true,
        };
        if (options.cwd != null) {
            spawnOptions.cwd = options.cwd;
        }
        // Fix npm / node executable paths on Windows
        if (isWindows) {
            if (command === 'npm') {
                command += '.cmd';
                // Needed since Node.js v18.20.2 and v20.12.2
                // https://github.com/nodejs/node/releases/tag/v18.20.2
                spawnOptions.shell = true;
            }
            else if (command === 'node') {
                command += '.exe';
            }
        }
        if (options.logCommandExecution == null) {
            options.logCommandExecution = false;
        }
        if (options.logCommandExecution) {
            console.log(`executing: ${command} ${args.join(' ')}`);
        }
        // Now execute the npm process and avoid throwing errors
        try {
            let bufferedStdout;
            let bufferedStderr;
            const cmd = (0, node_child_process_1.spawn)(command, args, spawnOptions)
                .on('error', error => {
                // The process could not be spawned at all - e.g. the command does not
                // exist or the cwd is missing. Without a listener, Node treats this as
                // an unhandled 'error' event and tears down the entire test process
                // with a stack trace from node:internal, which tells the adapter
                // developer nothing about the actual cause.
                // Node emits 'close' after 'error' in this case; that second resolve
                // is a no-op because the promise is already settled.
                resolve({
                    error,
                    stdout: bufferedStdout,
                    stderr: bufferedStderr,
                });
            })
                .on('close', (code, signal) => {
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
                cmd.stdout.on('data', (chunk) => {
                    if (Buffer.isBuffer(chunk)) {
                        chunk = chunk.toString('utf8');
                    }
                    bufferedStdout += chunk;
                });
            }
            if (options.stderr === 'pipe') {
                bufferedStderr = '';
                cmd.stderr.on('data', (chunk) => {
                    if (Buffer.isBuffer(chunk)) {
                        chunk = chunk.toString('utf8');
                    }
                    bufferedStderr += chunk;
                });
            }
        }
        catch (error) {
            // `spawn` can also throw synchronously, e.g. on invalid arguments. There is no
            // child process in that case, so neither 'close' nor 'error' will ever fire and
            // the promise would stay pending forever.
            resolve({ error: error });
        }
    });
}
