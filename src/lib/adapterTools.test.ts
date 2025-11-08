import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { locateAdapterMainFile } from './adapterTools';

use(chaiAsPromised);

describe('adapterTools', () => {
    describe('locateAdapterMainFile()', () => {
        let testDir: string;

        beforeEach(async () => {
            // Create a temporary directory for each test
            testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'adapter-test-'));
        });

        afterEach(async () => {
            // Clean up the temporary directory
            await fs.remove(testDir);
        });

        it('should find a .js main file specified in io-package.json', async () => {
            await fs.writeJson(path.join(testDir, 'io-package.json'), {
                common: {
                    name: 'test-adapter',
                    main: 'build/main.js',
                },
            });
            await fs.writeJson(path.join(testDir, 'package.json'), {
                name: 'iobroker.test-adapter',
            });
            await fs.ensureDir(path.join(testDir, 'build'));
            await fs.writeFile(path.join(testDir, 'build', 'main.js'), '// test');

            const mainFile = await locateAdapterMainFile(testDir);
            expect(mainFile).to.equal(path.join(testDir, 'build', 'main.js'));
        });

        it('should find a .ts main file specified in io-package.json', async () => {
            await fs.writeJson(path.join(testDir, 'io-package.json'), {
                common: {
                    name: 'test-adapter',
                    main: 'src/main.ts',
                },
            });
            await fs.writeJson(path.join(testDir, 'package.json'), {
                name: 'iobroker.test-adapter',
            });
            await fs.ensureDir(path.join(testDir, 'src'));
            await fs.writeFile(path.join(testDir, 'src', 'main.ts'), '// test');

            const mainFile = await locateAdapterMainFile(testDir);
            expect(mainFile).to.equal(path.join(testDir, 'src', 'main.ts'));
        });

        it('should find a .ts file when .js is specified but only .ts exists', async () => {
            await fs.writeJson(path.join(testDir, 'io-package.json'), {
                common: {
                    name: 'test-adapter',
                    main: 'src/main.js',
                },
            });
            await fs.writeJson(path.join(testDir, 'package.json'), {
                name: 'iobroker.test-adapter',
            });
            await fs.ensureDir(path.join(testDir, 'src'));
            await fs.writeFile(path.join(testDir, 'src', 'main.ts'), '// test');

            const mainFile = await locateAdapterMainFile(testDir);
            expect(mainFile).to.equal(path.join(testDir, 'src', 'main.ts'));
        });

        it('should find adapter-name.js as fallback', async () => {
            await fs.writeJson(path.join(testDir, 'io-package.json'), {
                common: {
                    name: 'test-adapter',
                },
            });
            await fs.writeJson(path.join(testDir, 'package.json'), {
                name: 'iobroker.test-adapter',
            });
            await fs.writeFile(path.join(testDir, 'test-adapter.js'), '// test');

            const mainFile = await locateAdapterMainFile(testDir);
            expect(mainFile).to.equal(path.join(testDir, 'test-adapter.js'));
        });

        it('should find adapter-name.ts as fallback', async () => {
            await fs.writeJson(path.join(testDir, 'io-package.json'), {
                common: {
                    name: 'test-adapter',
                },
            });
            await fs.writeJson(path.join(testDir, 'package.json'), {
                name: 'iobroker.test-adapter',
            });
            await fs.writeFile(path.join(testDir, 'test-adapter.ts'), '// test');

            const mainFile = await locateAdapterMainFile(testDir);
            expect(mainFile).to.equal(path.join(testDir, 'test-adapter.ts'));
        });

        it('should throw an error when no main file is found', async () => {
            await fs.writeJson(path.join(testDir, 'io-package.json'), {
                common: {
                    name: 'test-adapter',
                },
            });
            await fs.writeJson(path.join(testDir, 'package.json'), {
                name: 'iobroker.test-adapter',
            });

            await expect(locateAdapterMainFile(testDir)).to.be.rejectedWith('The adapter main file was not found');
        });

        it('should prefer .js over .ts when both exist', async () => {
            await fs.writeJson(path.join(testDir, 'io-package.json'), {
                common: {
                    name: 'test-adapter',
                    main: 'src/main.js',
                },
            });
            await fs.writeJson(path.join(testDir, 'package.json'), {
                name: 'iobroker.test-adapter',
            });
            await fs.ensureDir(path.join(testDir, 'src'));
            await fs.writeFile(path.join(testDir, 'src', 'main.js'), '// js file');
            await fs.writeFile(path.join(testDir, 'src', 'main.ts'), '// ts file');

            const mainFile = await locateAdapterMainFile(testDir);
            expect(mainFile).to.equal(path.join(testDir, 'src', 'main.js'));
        });
    });
});
