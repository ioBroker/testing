"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATES_PORT_ENV = exports.OBJECTS_PORT_ENV = exports.DEFAULT_TEST_PORTS = void 0;
exports.resolveTestPorts = resolveTestPorts;
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
    const port = typeof value === 'number' ? value : Number(value);
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
