import { expect } from 'chai';
import { createServer, type AddressInfo, type Server } from 'node:net';
import { assertPortsAvailable, DEFAULT_TEST_PORTS, OBJECTS_PORT_ENV, resolveTestPorts, STATES_PORT_ENV } from './ports';

describe('resolveTestPorts()', () => {
    it('uses the defaults when nothing is configured', () => {
        expect(resolveTestPorts({}, {})).to.deep.equal({ objects: 19001, states: 19000 });
        expect(resolveTestPorts(undefined, {})).to.deep.equal(DEFAULT_TEST_PORTS);
    });

    it('reads the environment variables', () => {
        expect(resolveTestPorts({}, { [OBJECTS_PORT_ENV]: '29001', [STATES_PORT_ENV]: '29000' })).to.deep.equal({
            objects: 29001,
            states: 29000,
        });
    });

    it('lets the option win over the environment', () => {
        expect(
            resolveTestPorts(
                { objects: 39001, states: 39000 },
                { [OBJECTS_PORT_ENV]: '29001', [STATES_PORT_ENV]: '29000' },
            ),
        ).to.deep.equal({ objects: 39001, states: 39000 });
    });

    it('fills a partial option from the environment and the defaults', () => {
        expect(resolveTestPorts({ objects: 39001 }, {})).to.deep.equal({ objects: 39001, states: 19000 });
        expect(resolveTestPorts({ objects: 39001 }, { [STATES_PORT_ENV]: '29000' })).to.deep.equal({
            objects: 39001,
            states: 29000,
        });
    });

    it('treats an empty environment variable as unset', () => {
        expect(resolveTestPorts({}, { [OBJECTS_PORT_ENV]: '', [STATES_PORT_ENV]: '' })).to.deep.equal(
            DEFAULT_TEST_PORTS,
        );
    });

    it('rejects a port that is not an integer in range', () => {
        expect(() => resolveTestPorts({ objects: 0 }, {})).to.throw('ports.objects');
        expect(() => resolveTestPorts({ states: 65536 }, {})).to.throw('ports.states');
        expect(() => resolveTestPorts({ objects: 19001.5 }, {})).to.throw('ports.objects');
        expect(() => resolveTestPorts({}, { [OBJECTS_PORT_ENV]: 'abc' })).to.throw(OBJECTS_PORT_ENV);
    });

    it('accepts only plain decimal numbers from the environment', () => {
        expect(() => resolveTestPorts({}, { [OBJECTS_PORT_ENV]: '0x7530' })).to.throw(OBJECTS_PORT_ENV);
        expect(() => resolveTestPorts({}, { [STATES_PORT_ENV]: '1e4' })).to.throw(STATES_PORT_ENV);
        expect(() => resolveTestPorts({}, { [STATES_PORT_ENV]: ' 29000' })).to.throw(STATES_PORT_ENV);
    });

    it('rejects the same port for both DBs', () => {
        expect(() => resolveTestPorts({ objects: 29000, states: 29000 }, {})).to.throw('different ports');
        expect(() => resolveTestPorts({ objects: 19000 }, {})).to.throw('different ports');
    });
});

describe('assertPortsAvailable()', () => {
    function listen(server: Server, port: number): Promise<number> {
        return new Promise(resolve =>
            server.listen(port, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)),
        );
    }

    function close(server: Server): Promise<void> {
        return new Promise(resolve => server.close(() => resolve()));
    }

    async function getFreePort(): Promise<number> {
        const server = createServer();
        const port = await listen(server, 0);
        await close(server);
        return port;
    }

    async function getError(promise: Promise<void>): Promise<Error | undefined> {
        try {
            await promise;
        } catch (e) {
            return e as Error;
        }
        return undefined;
    }

    let blocker: Server;
    let busyPort: number;

    beforeEach(async () => {
        blocker = createServer();
        busyPort = await listen(blocker, 0);
    });

    afterEach(() => close(blocker));

    it('resolves when both ports are free', async () => {
        const objects = await getFreePort();
        let states = await getFreePort();
        while (states === objects) {
            states = await getFreePort();
        }
        expect(await getError(assertPortsAvailable({ objects, states }))).to.be.undefined;
    });

    it('rejects with a clear message when the objects port is in use', async () => {
        const error = await getError(assertPortsAvailable({ objects: busyPort, states: await getFreePort() }));
        expect(error?.message).to.include(`Port ${busyPort} for the objects DB is already in use`);
        expect(error?.message).to.include(OBJECTS_PORT_ENV);
    });

    it('rejects with a clear message when the states port is in use', async () => {
        const error = await getError(assertPortsAvailable({ objects: await getFreePort(), states: busyPort }));
        expect(error?.message).to.include(`Port ${busyPort} for the states DB is already in use`);
    });
});
