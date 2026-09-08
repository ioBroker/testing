import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as os from 'node:os';
import * as path from 'node:path';
import { ControllerSetup } from './controllerSetup';
import { DBConnection } from './dbConnection';
import { createLogger } from './logger';
import { getTestDataDir } from './tools';

describe('ControllerSetup.setupSystemConfig()', () => {
    let tmp: string;
    let adapterDir: string;
    let testDir: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'testing-ports-'));
        adapterDir = path.join(tmp, 'ioBroker.demo');
        testDir = path.join(tmp, 'test');
        fs.outputJSONSync(path.join(adapterDir, 'package.json'), { name: 'iobroker.demo', version: '0.0.1' });
        fs.outputJSONSync(path.join(adapterDir, 'io-package.json'), { common: { name: 'demo' } });
        fs.outputJSONSync(path.join(getTestDataDir('iobroker', testDir), 'iobroker.json'), {
            objects: { type: 'file', host: '127.0.0.1', port: 9001 },
            states: { type: 'file', host: '127.0.0.1', port: 9000 },
        });
    });

    afterEach(() => {
        fs.removeSync(tmp);
    });

    function systemConfigPorts(): { objects: number; states: number } {
        const config = fs.readJSONSync(path.join(getTestDataDir('iobroker', testDir), 'iobroker.json'));
        return { objects: config.objects.port, states: config.states.port };
    }

    it('moves the DBs to the default test ports when no ports are given', () => {
        const db = new DBConnection('iobroker', testDir, createLogger('error'));
        new ControllerSetup(adapterDir, testDir).setupSystemConfig(db);
        expect(systemConfigPorts()).to.deep.equal({ objects: 19001, states: 19000 });
    });

    it('writes the given ports into the system config', () => {
        const db = new DBConnection('iobroker', testDir, createLogger('error'));
        new ControllerSetup(adapterDir, testDir).setupSystemConfig(db, { objects: 29001, states: 29000 });
        expect(systemConfigPorts()).to.deep.equal({ objects: 29001, states: 29000 });
    });

    it('keeps the rest of the system config untouched', () => {
        const db = new DBConnection('iobroker', testDir, createLogger('error'));
        new ControllerSetup(adapterDir, testDir).setupSystemConfig(db, { objects: 29001, states: 29000 });
        const config = fs.readJSONSync(path.join(getTestDataDir('iobroker', testDir), 'iobroker.json'));
        expect(config.objects.type).to.equal('file');
        expect(config.states.host).to.equal('127.0.0.1');
    });
});

describe('DBConnection ports', () => {
    it('defaults to the standard test ports', () => {
        const db = new DBConnection('iobroker', path.join(os.tmpdir(), 'unused'), createLogger('error'));
        expect(db.ports).to.deep.equal({ objects: 19001, states: 19000 });
    });

    it('carries the ports it was created with', () => {
        const db = new DBConnection('iobroker', path.join(os.tmpdir(), 'unused'), createLogger('error'), {
            objects: 29001,
            states: 29000,
        });
        expect(db.ports).to.deep.equal({ objects: 29001, states: 29000 });
    });
});
