/** The TCP ports the objects and states DBs of the test controller listen on */
export interface TestPorts {
    /** Port of the objects DB */
    objects: number;
    /** Port of the states DB */
    states: number;
}
/** The ports used when neither the `ports` option nor the environment says otherwise */
export declare const DEFAULT_TEST_PORTS: Readonly<TestPorts>;
/** Environment variable that sets the objects DB port when the `ports` option does not */
export declare const OBJECTS_PORT_ENV = "IOBROKER_TESTING_OBJECTS_PORT";
/** Environment variable that sets the states DB port when the `ports` option does not */
export declare const STATES_PORT_ENV = "IOBROKER_TESTING_STATES_PORT";
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
export declare function resolveTestPorts(options?: Partial<TestPorts>, env?: NodeJS.ProcessEnv): TestPorts;
/**
 * Makes sure nothing listens on the DB ports yet. Without this check, a DB server on a port that is
 * already in use never comes up, and the test run only fails once the hook times out.
 *
 * @param ports the ports the objects and states DBs are going to use
 * @param host the address the DBs listen on
 */
export declare function assertPortsAvailable(ports: Readonly<TestPorts>, host?: string): Promise<void>;
