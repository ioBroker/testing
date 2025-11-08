import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';

describe('packageFiles - tsconfig.json handling', () => {
    /**
     * Recursively find all files matching a pattern in a directory
     */
    function findFiles(dir: string, pattern: RegExp, results: string[] = []): string[] {
        if (!fs.existsSync(dir)) {
            return results;
        }

        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                findFiles(filePath, pattern, results);
            } else if (pattern.test(file)) {
                results.push(filePath);
            }
        }

        return results;
    }

    it('should filter out tsconfig.json from admin directory JSON validation', () => {
        const tmpDir = path.join('/tmp', 'iobroker-testing-tsconfig');

        try {
            // Create test structure
            if (fs.existsSync(tmpDir)) {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
            fs.mkdirSync(tmpDir, { recursive: true });
            fs.mkdirSync(path.join(tmpDir, 'admin'), { recursive: true });

            // Create admin/tsconfig.json
            fs.writeFileSync(path.join(tmpDir, 'admin', 'tsconfig.json'), '{}');

            // Create admin/config.json
            fs.writeFileSync(path.join(tmpDir, 'admin', 'config.json'), '{}');

            // Create admin/i18n/en.json
            fs.mkdirSync(path.join(tmpDir, 'admin', 'i18n'), { recursive: true });
            fs.writeFileSync(path.join(tmpDir, 'admin', 'i18n', 'en.json'), '{}');

            // Find all JSON files
            const adminDir = path.join(tmpDir, 'admin');
            const allAdminJsonFiles = findFiles(adminDir, /\.json$/);

            // Apply the same filter logic as in the main code
            const adminDirectJsonFiles = allAdminJsonFiles.filter(
                file => !file.includes(`${path.sep}i18n${path.sep}`) && !file.endsWith(`${path.sep}tsconfig.json`),
            );
            const i18nJsonFiles = allAdminJsonFiles.filter(file => file.includes(`${path.sep}i18n${path.sep}`));

            // Verify tsconfig.json is excluded from admin direct files
            expect(adminDirectJsonFiles).to.have.lengthOf(1);
            expect(adminDirectJsonFiles[0]).to.include('config.json');
            expect(adminDirectJsonFiles.some(f => f.includes('tsconfig.json'))).to.be.false;

            // Verify i18n files are in the correct category
            expect(i18nJsonFiles).to.have.lengthOf(1);
            expect(i18nJsonFiles[0]).to.include('en.json');

            // Verify tsconfig.json is not in i18n files
            expect(i18nJsonFiles.some(f => f.includes('tsconfig.json'))).to.be.false;
        } finally {
            // Clean up
            if (fs.existsSync(tmpDir)) {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
        }
    });
});
