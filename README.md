# @iobroker/testing

This repo provides utilities for testing of ioBroker adapters and other ioBroker-related modules. It supports:

-   **Unit tests** using mocks (without a running JS-Controller) **deprecated** and no longer used
-   **Integration tests** that test against a running JS-Controller instance.

The unit tests are realized using the following tools that are provided by this module:

-   A mock database that implements the most basic functionality of `ioBroker`'s Objects and States DB by operating on `Map` objects.
-   A mock `Adapter` that is connected to the mock database. It implements basic functionality of the real `Adapter` class, but only operates on the mock database.

Predefined methods for both unit and integration tests are exported.

## Usage

### Validating package files (package.json, io-package.json, ...)

```ts
const path = require("path");
const { tests } = require("@iobroker/testing");

// Run tests
tests.packageFiles(path.join(__dirname, ".."));
//                 ~~~~~~~~~~~~~~~~~~~~~~~~~
// This should be the adapter's root directory
```

### Adapter startup (Integration test)

Run the following snippet in a `mocha` test file to test the adapter startup process against a real JS-Controller instance:

```ts
const path = require("path");
const { tests } = require("@iobroker/testing");

// Run tests
tests.integration(path.join(__dirname, ".."), {
	//            ~~~~~~~~~~~~~~~~~~~~~~~~~
	// This should be the adapter's root directory

	// If the adapter may call process.exit during startup, define here which exit codes are allowed.
	// By default, termination during startup is not allowed.
	allowedExitCodes: [11],

	// To test against a different version of JS-Controller, you can change the version or dist-tag here.
	// Make sure to remove this setting when you're done testing.
	controllerVersion: "latest", // or a specific version like "4.0.1"

	// Define your own tests inside defineAdditionalTests
	defineAdditionalTests({ suite }) {
		// All tests (it, describe) must be grouped in one or more suites. Each suite sets up a fresh environment for the adapter tests.
		// At the beginning of each suite, the databases will be reset and the adapter will be started.
		// The adapter will run until the end of each suite.

		// Since the tests are heavily instrumented, each suite gives access to a so called "harness" to control the tests.
		suite("Test sendTo()", (getHarness) => {
			// For convenience, get the current suite's harness before all tests
			let harness;
			before(() => {
				harness = getHarness();
			});

			it("Should work", () => {
				return new Promise(async (resolve) => {
					// Start the adapter and wait until it has started
					await harness.startAdapterAndWait();

					// Perform the actual test:
					harness.sendTo("adapter.0", "test", "message", (resp) => {
						console.dir(resp);
						resolve();
					});
				});
			});
		});

		// While developing the tests, you can run only a single suite using `suite.only`...
		suite.only("Only this will run", (getHarness) => {
			// ...
		});
		// ...or prevent a suite from running using `suite.skip`:
		suite.skip("This will never run", (getHarness) => {
			// ...
		});
	},
});
```

### Adapter startup (Unit test)

**Unit tests for adapter startup were removed and are essentially a no-op now.**  
If you defined your own tests, they should still work.

```ts
const path = require("path");
const { tests } = require("@iobroker/testing");

tests.unit(path.join(__dirname, ".."), {
	//     ~~~~~~~~~~~~~~~~~~~~~~~~~
	// This should be the adapter's root directory

	// Define your own tests inside defineAdditionalTests.
	// If you need predefined objects etc. here, you need to take care of it yourself
	defineAdditionalTests() {
		it("works", () => {
			// see below how these could look like
		});
	},
});
```

### Helper functions for your own tests

Under `utils`, several functions are exposed to use in your own tests:

```ts
const { utils } = require("@iobroker/testing");
```

Currently, only `utils.unit` is defined which contains tools for unit tests:

#### createMocks()

```ts
const { database, adapter } = utils.unit.createMocks();
// or (with custom adapter options)
const { database, adapter } = utils.unit.createMocks(adapterOptions);
```

This method creates a mock database and a mock adapter. See below for a more detailed description

#### createAsserts()

```ts
const asserts = utils.unit.createAsserts(database, adapter);
```

These methods take a mock database and adapter and create a set of assertions for your tests. All IDs may either be a string, which is taken literally, or an array of strings which are concatenated with `"."`. If an ID is not fully qualified, the adapter namespace is prepended automatically.

-   `assertObjectExists(id: string | string[])` asserts that an object with the given ID exists in the database.
-   `assertStateExists(id: string | string[])` asserts that a state with the given ID exists in the database.
-   `assertStateHasValue(id: string | string[], value: any)` asserts that a state has the given value.
-   `assertStateIsAcked(id: string | string[], ack: boolean = true)` asserts that a state is `ack`ed (or not if `ack === false`).
-   `assertStateProperty(id: string | string[], property: string, value: any)` asserts that one of the state's properties (e.g. `from`) has the given value
-   `assertObjectCommon(id: string | string[], common: ioBroker.ObjectCommon)` asserts that an object's common part includes the given `common` object.
-   `assertObjectNative(id: string | string[], native: object)` asserts that an object's native part includes the given `native` object.

#### MockDatabase

`MockDatabase` is a minimalistic reimplementation of ioBroker's Objects and States DB that operates purely on in-memory `Map`s. It is created for you by `createMocks()`, but you can also instantiate it directly:

```ts
const { MockDatabase } = require("@iobroker/testing");
const database = new MockDatabase();
```

Objects and states are stored under their fully qualified ID (e.g. `"adapter.0.some.state"`). Wherever a method comes in two overloads, you can either pass the full ID as a single string or pass the namespace and the rest of the ID separately (they are joined with `"."`). Pattern-based getters accept `ioBroker`-style wildcards (`*`).

Populating the database:

-   `publishObject(obj: ioBroker.PartialObject)` adds or replaces an object. The object **must** have an `_id` and a `type`; missing `common`/`native` are filled from a default template.
-   `publishObjects(...objects)` publishes multiple objects at once.
-   `publishStateObjects(...objects)` / `publishChannelObjects(...objects)` / `publishDeviceObjects(...objects)` publish objects while forcing their `type` to `state` / `channel` / `device`.
-   `publishState(id: string, state: Partial<ioBroker.State> | null | undefined)` sets a state (missing properties are filled from a default template). Passing `null`/`undefined` deletes it.
-   `publishStates(states: Record<string, Partial<ioBroker.State> | null | undefined>)` sets multiple states at once.

Reading and querying:

-   `hasObject(id)` / `hasObject(namespace, id)` returns whether an object exists.
-   `getObject(id)` / `getObject(namespace, id)` returns an object or `undefined`.
-   `getObjects(pattern, type?)` / `getObjects(namespace, pattern, type?)` returns all matching objects as a `Record<string, ioBroker.Object>`, optionally filtered by `type`.
-   `hasState(id)` / `hasState(namespace, id)` returns whether a state exists.
-   `getState(id)` / `getState(namespace, id)` returns a state or `undefined`.
-   `getStates(pattern)` returns all matching states as a `Record<string, ioBroker.State>`.

Deleting and resetting:

-   `deleteObject(objOrID)` removes an object (accepts the object or its ID).
-   `deleteState(id)` removes a state.
-   `clearObjects()` / `clearStates()` empty the respective store, `clear()` empties both. Call this between tests to start with a fresh database.

#### MockAdapter

`MockAdapter` is a mock of ioBroker's `Adapter` class in which every method is replaced by a [Sinon stub](https://sinonjs.org/releases/latest/stubs/). It is created by `createMocks()` and is backed by a `MockDatabase`, so the DB-related methods actually read from and write to that database instead of a real DB.

```ts
const { database, adapter } = utils.unit.createMocks();
// or with custom adapter options (name, instance, config, ...)
const { database, adapter } = utils.unit.createMocks({ name: "my-adapter" });
```

Because the methods are Sinon stubs, you can assert on how your adapter code called them and override their behavior in individual tests:

```ts
// Assert that a state was set
adapter.setState.callCount.should.equal(1);
adapter.setState.getCall(0).args[0].should.equal("info.connection");

// Override the return value / behavior for a single test
adapter.getForeignObjectAsync.resolves({ common: { name: "test" } });
```

Key features:

-   **Connected to the database:** methods like `getObject`, `setObject`, `setObjectNotExists`, `extendObject`, `getState`, `setState`, `setStateChanged`, `delState`, their `Foreign` variants and `getObjectView` / `getObjectList` are implemented to operate on the backing `MockDatabase`. IDs that are not fully qualified are automatically prefixed with the adapter namespace. The remaining methods are plain stubs that do nothing until you give them a behavior.
-   **Promisified methods:** for every callback-style method, the corresponding `...Async` version (e.g. `getStateAsync`) is available, just like on a real adapter.
-   **Event handlers:** the handlers your adapter registers (via `adapter.on(...)` or the adapter options) are captured and exposed so you can invoke them from your tests: `readyHandler`, `stateChangeHandler`, `objectChangeHandler`, `messageHandler` and `unloadHandler`. For example, call `await adapter.readyHandler()` to simulate the adapter's startup.
-   **Logger:** `adapter.log` is a `MockLogger` whose `debug` / `info` / `warn` / `error` methods are stubs you can assert on.
-   **`terminate()`** throws an error (carrying the exit reason) instead of exiting the process, so you can assert that your adapter tried to terminate.

Resetting the mock between tests:

-   `resetMockHistory()` clears the recorded call history (call counts, arguments, ...) of all stubs and the logger, but keeps any custom behavior you configured.
-   `resetMockBehavior()` restores the default behavior of all stubs, discarding your overrides.
-   `resetMock()` does both.

### Example

Here's an example of how this can be used in a unit test:

```ts
import { tests, utils } from "@iobroker/testing";

// Run tests
tests.unit(path.join(__dirname, ".."), {
	//     ~~~~~~~~~~~~~~~~~~~~~~~~~
	// This should be the adapter's root directory

	// Define your own tests inside defineAdditionalTests
	defineAdditionalTests() {
		// Create mocks and asserts
		const { adapter, database } = utils.unit.createMocks();
		const { assertObjectExists } = utils.unit.createAsserts(
			database,
			adapter,
		);

		describe("my test", () => {
			afterEach(() => {
				// The mocks keep track of all method invocations - reset them after each single test
				adapter.resetMockHistory();
				// We want to start each test with a fresh database
				database.clear();
			});

			it("works", () => {
				// Create an object in the fake db we will use in this test
				const theObject: ioBroker.PartialObject = {
					_id: "whatever",
					type: "state",
					common: {
						role: "whatever",
					},
				};
				mocks.database.publishObject(theObject);

				// Do something that should be tested

				// Assert that the object still exists
				assertObjectExists(theObject._id);
			});
		});
	},
});
```
