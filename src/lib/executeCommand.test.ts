import { expect } from 'chai';
import * as os from 'node:os';
import * as path from 'node:path';
import { executeCommand } from './executeCommand';

describe('executeCommand', () => {
    it('should resolve with the exit code and the piped stdout', async () => {
        const result = await executeCommand(process.execPath, ['-e', 'process.stdout.write("hello")'], {
            stdout: 'pipe',
            stderr: 'pipe',
        });
        expect(result.exitCode).to.equal(0);
        expect(result.stdout).to.equal('hello');
        expect(result.error).to.be.undefined;
    });

    it('should pass a non-zero exit code through', async () => {
        const result = await executeCommand(process.execPath, ['-e', 'process.exit(3)'], {
            stdout: 'ignore',
            stderr: 'ignore',
        });
        expect(result.exitCode).to.equal(3);
        expect(result.error).to.be.undefined;
    });

    it('should resolve instead of crashing the process when the command does not exist', async () => {
        // Without an 'error' listener, Node treats the spawn failure as an unhandled
        // 'error' event and tears down the whole test process before Mocha can report.
        const result = await executeCommand('io-broker-testing-nonexistent-command', ['--version'], {
            stdout: 'pipe',
            stderr: 'pipe',
        });
        expect(result.error).to.be.instanceOf(Error);
        expect((result.error as NodeJS.ErrnoException).code).to.equal('ENOENT');
        expect(result.exitCode).to.be.undefined;
    });

    it('should resolve instead of crashing the process when the cwd does not exist', async () => {
        const result = await executeCommand(process.execPath, ['-v'], {
            cwd: path.join(os.tmpdir(), 'io-broker-testing-nonexistent-dir'),
            stdout: 'pipe',
            stderr: 'pipe',
        });
        expect(result.error).to.be.instanceOf(Error);
        expect(result.exitCode).to.be.undefined;
    });
});
