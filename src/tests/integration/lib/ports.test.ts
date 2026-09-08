import { expect } from 'chai';
import { DEFAULT_TEST_PORTS, OBJECTS_PORT_ENV, resolveTestPorts, STATES_PORT_ENV } from './ports';

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

    it('rejects the same port for both DBs', () => {
        expect(() => resolveTestPorts({ objects: 29000, states: 29000 }, {})).to.throw('different ports');
        expect(() => resolveTestPorts({ objects: 19000 }, {})).to.throw('different ports');
    });
});
