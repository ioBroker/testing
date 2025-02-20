"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeCommand = executeCommand;
const child_process_1 = require("child_process");
const isWindows = /^win/.test(process.platform);
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
            const cmd = (0, child_process_1.spawn)(command, args, spawnOptions).on('close', (code, signal) => {
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
        catch {
            // doesn't matter, we return the exit code in the "close" handler
        }
    });
}
