import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as fs from 'fs-extra';
import { EventEmitter } from 'node:events';
import * as os from 'node:os';
import * as path from 'node:path';
import type { DBConnection } from './dbConnection';
import { TestHarness } from './harness';

use(chaiAsPromised);

const secret = 'Zgfr56gFe87jJOM';

/** The reference implementation from the JS-Controller */
function encrypt(key: string, value: string): string {
    let result = '';
    for (let i = 0; i < value.length; ++i) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}

/** A minimal stand-in for the DBConnection that serves objects from a Map */
class MockDBConnection extends EventEmitter {
    public readonly objects = new Map<string, any>();

    public getObject = (id: string): Promise<any> => Promise.resolve(this.objects.get(id));

    public setObject = (id: string, obj: any): Promise<any> => {
        this.objects.set(id, obj);
        return Promise.resolve({ id });
    };
}

describe('TestHarness', () => {
    let testDir: string;
    let dbConnection: MockDBConnection;
    let harness: TestHarness;

    beforeEach(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-test-'));
        await fs.writeJson(path.join(testDir, 'package.json'), { name: 'iobroker.test-adapter' });
        await fs.writeJson(path.join(testDir, 'io-package.json'), {
            common: { name: 'test-adapter', main: 'main.js' },
        });

        dbConnection = new MockDBConnection();
        dbConnection.objects.set('system.config', { type: 'config', native: { secret } });
        dbConnection.objects.set('system.adapter.test-adapter.0', {
            type: 'instance',
            common: { name: 'test-adapter', enabled: false },
            native: {},
            encryptedNative: ['password', 'token'],
        });

        harness = new TestHarness(testDir, testDir, dbConnection as unknown as DBConnection);
    });

    afterEach(async () => {
        await fs.remove(testDir);
    });

    describe('encryptValue() / decryptValue()', () => {
        it('encrypts a value with the secret from system.config', async () => {
            expect(await harness.encryptValue('s3cret!')).to.equal(encrypt(secret, 's3cret!'));
        });

        it('decrypting an encrypted value returns the original one', async () => {
            const encrypted = await harness.encryptValue('äöü 123 !"§');
            expect(encrypted).to.not.equal('äöü 123 !"§');
            expect(await harness.decryptValue(encrypted)).to.equal('äöü 123 !"§');
        });

        it('handles empty strings', async () => {
            expect(await harness.encryptValue('')).to.equal('');
        });

        it('only reads the system.config object once', async () => {
            await harness.encryptValue('foo');
            dbConnection.objects.delete('system.config');
            expect(await harness.decryptValue(await harness.encryptValue('foo'))).to.equal('foo');
        });

        it('throws if the system secret cannot be read', async () => {
            dbConnection.objects.set('system.config', { type: 'config', native: {} });
            await expect(harness.encryptValue('foo')).to.be.rejectedWith('system.config');
        });
    });

    describe('changeAdapterConfig()', () => {
        it('encrypts the native properties listed in encryptedNative', async () => {
            await harness.changeAdapterConfig('test-adapter', {
                native: { password: 'p4ssword', token: 'abc', user: 'admin' },
            });

            const obj = dbConnection.objects.get('system.adapter.test-adapter.0');
            expect(obj.native.password).to.equal(encrypt(secret, 'p4ssword'));
            expect(obj.native.token).to.equal(encrypt(secret, 'abc'));
            // Everything else is stored as-is
            expect(obj.native.user).to.equal('admin');
        });

        it('does not modify the passed changes', async () => {
            const changes = { native: { password: 'p4ssword' } };
            await harness.changeAdapterConfig('test-adapter', changes);
            expect(changes.native.password).to.equal('p4ssword');
        });

        it('leaves properties untouched that are not part of the changes', async () => {
            await harness.changeAdapterConfig('test-adapter', { common: { enabled: true } });

            const obj = dbConnection.objects.get('system.adapter.test-adapter.0');
            expect(obj.common.enabled).to.equal(true);
            expect(obj.native).to.deep.equal({});
        });

        it('does not encrypt non-string values', async () => {
            await harness.changeAdapterConfig('test-adapter', { native: { password: 42, token: null } });

            const obj = dbConnection.objects.get('system.adapter.test-adapter.0');
            expect(obj.native.password).to.equal(42);
            expect(obj.native.token).to.equal(null);
        });

        it('works for instances without encryptedNative', async () => {
            dbConnection.objects.set('system.adapter.other.0', {
                type: 'instance',
                common: { name: 'other' },
                native: {},
            });
            await harness.changeAdapterConfig('other', { native: { password: 'p4ssword' } });

            expect(dbConnection.objects.get('system.adapter.other.0').native.password).to.equal('p4ssword');
        });
    });

    describe('getAdapterConfig()', () => {
        it('decrypts the native properties listed in encryptedNative', async () => {
            await harness.changeAdapterConfig('test-adapter', {
                native: { password: 'p4ssword', user: 'admin' },
            });

            const obj = await harness.getAdapterConfig('test-adapter');
            expect(obj!.native.password).to.equal('p4ssword');
            expect(obj!.native.user).to.equal('admin');
            // The stored object is not modified
            expect(dbConnection.objects.get('system.adapter.test-adapter.0').native.password).to.equal(
                encrypt(secret, 'p4ssword'),
            );
        });

        it('defaults to the adapter under test', async () => {
            await harness.changeAdapterConfig('test-adapter', { native: { password: 'p4ssword' } });
            expect((await harness.getAdapterConfig())!.native.password).to.equal('p4ssword');
        });

        it('returns null for a non-existing instance', async () => {
            expect(await harness.getAdapterConfig('does-not-exist')).to.be.null;
        });
    });
});
