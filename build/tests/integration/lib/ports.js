"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATES_PORT_ENV = exports.OBJECTS_PORT_ENV = exports.DEFAULT_TEST_PORTS = void 0;
exports.resolveTestPorts = resolveTestPorts;
exports.assertPortsAvailable = assertPortsAvailable;
const node_net_1 = require("node:net");
/** The ports used when neither the `ports` option nor the environment says otherwise */
exports.DEFAULT_TEST_PORTS = Object.freeze({ objects: 19001, states: 19000 });
/** Environment variable that sets the objects DB port when the `ports` option does not */
exports.OBJECTS_PORT_ENV = 'IOBROKER_TESTING_OBJECTS_PORT';
/** Environment variable that sets the states DB port when the `ports` option does not */
exports.STATES_PORT_ENV = 'IOBROKER_TESTING_STATES_PORT';
/**
 * Parses one port value
 *
 * @param value the raw value from the option or the environment
 * @param name what to call the value in an error message
 * @returns the port, or undefined when nothing was given
 */
function parsePort(value, name) {
    if (value === undefined || value === '') {
        return undefined;
    }
    // Strings must be plain decimal numbers - Number() alone would also accept e.g. "0x7530" or "1e4"
    const port = typeof value === 'number' ? value : /^\d+$/.test(value) ? Number(value) : NaN;
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`${name} must be an integer between 1 and 65535, got ${JSON.stringify(value)}`);
    }
    return port;
}
/**
 * Resolves the DB ports for a test run: an explicit option wins, then the environment, then the defaults.
 *
 * Two adapter test runs on the same machine (two terminals, two CI jobs on one runner) collide as soon
 * as both start their DBs on the same ports — the second one fails to bind or, worse, talks to the
 * first one's databases. Giving each run its own pair of ports avoids that.
 *
 * @param options the `ports` option of the integration tests, if any
 * @param env the environment to read the variables from (defaults to the process environment)
 * @returns the ports to use
 */
function resolveTestPorts(options = {}, env = process.env) {
    const objects = parsePort(options.objects, 'ports.objects') ??
        parsePort(env[exports.OBJECTS_PORT_ENV], exports.OBJECTS_PORT_ENV) ??
        exports.DEFAULT_TEST_PORTS.objects;
    const states = parsePort(options.states, 'ports.states') ??
        parsePort(env[exports.STATES_PORT_ENV], exports.STATES_PORT_ENV) ??
        exports.DEFAULT_TEST_PORTS.states;
    if (objects === states) {
        throw new Error(`The objects and states DBs need different ports, but both would use ${objects}`);
    }
    return { objects, states };
}
/**
 * Tries to listen on a port and closes the server again right away
 *
 * @param port the port to try
 * @param host the address to listen on
 * @returns the error if listening failed, otherwise undefined
 */
function tryListen(port, host) {
    return new Promise(resolve => {
        const server = (0, node_net_1.createServer)();
        server.once('error', (err) => resolve(err));
        server.listen(port, host, () => server.close(() => resolve(undefined)));
    });
}
/**
 * Makes sure nothing listens on the DB ports yet. Without this check, a DB server on a port that is
 * already in use never comes up, and the test run only fails once the hook times out.
 *
 * @param ports the ports the objects and states DBs are going to use
 * @param host the address the DBs listen on
 */
async function assertPortsAvailable(ports, host = '127.0.0.1') {
    for (const [db, port] of [
        ['objects', ports.objects],
        ['states', ports.states],
    ]) {
        const error = await tryListen(port, host);
        if (error) {
            const reason = error.code === 'EADDRINUSE' ? 'is already in use' : `cannot be used (${error.code ?? error.message})`;
            throw new Error(`Port ${port} for the ${db} DB ${reason}. Is another integration test run active on this machine? ` +
                `Stop it or give this run other ports via the "ports" option or the environment variables ` +
                `${exports.OBJECTS_PORT_ENV} / ${exports.STATES_PORT_ENV}.`);
        }
    }
}
