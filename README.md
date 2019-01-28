# @iobroker/testing

This repo provides utilities for "offline" (without a running JS-Controller) testing of adapters and other ioBroker-related modules. It contains the following:
* A mock database which implements the most basic functionality of `ioBroker`'s Objects and States DB by operating on `Map` objects.
* A mock `Adapter` that is connected to the mock database. It implements basic functionality of the real `Adapter` class, but only operates on the mock database.
* Predefined unit tests using `mocha` and `chai` to be used in every adapter.

## Usage
Here's an example how this can be used in a unit test. Note that this will not be the final syntax:
```ts
import { createMocks, createAsserts } from "@iobroker/testing";
const { adapter, database } = createMocks();
const { assertObjectExists } = createAsserts();

const { ClassToBeTested } = proxyquire<typeof import("./class-to-be-tested")>("./class-to-be-tested", {
	"./something-that-uses-adapter": adapter,
});

describe("class-to-be-tested", () => {

	afterEach(() => {
		// The mocks keep track of all method invocations - reset those after each single test
		adapter.resetMockHistory();
		// We want to start each test with a fresh database
		database.clear();
	});

	it("should do something", async () => {
		const cls = new ClassToBeTested();

		// Create an object in the fake db we will use in this test
		const theObject: ioBroker.PartialObject = {
			_id: "whatever",
			type: "state",
			common: {
				role: "whatever",
			},
		};
		mocks.database.publishObject(theObject);

		await cls.doSomething();
		// Assert that the object still exists
		assertObjectExists(theObject._id);
	});
});
```