# @iobroker/testing

This repo provides utilities for "offline" (without a running JS-Controller) testing of adapters and other ioBroker-related modules. It contains the following:
* A mock database which implements the most basic functionality of `ioBroker`'s Objects and States DB by operating on `Map` objects.
* A mock `Adapter` that is connected to the mock database. It implements basic functionality of the real `Adapter` class, but only operates on the mock database.
* Predefined unit tests using `mocha` and `chai` to be used in every adapter.

## Usage

### Basic adapter startup test (offline)
Run the following snippet in a `mocha` test file to test the adapter startup process against a mock database.
If the adapter supports compact mode, that is tested aswell.
```ts
const path = require("path");
const { tests } = require("@iobroker/testing");

// You can also mock external modules to create a more controlled environment during testing.
// Define the mocks as objects and include them below
const nobleMock = {
    on() {},
    state: "poweredOff",
}

// Run tests
tests.offline.adapterStartup(path.join(__dirname, ".."), {
    //                       ~~~~~~~~~~~~~~~~~~~~~~~~~
    // This should be the adapter's root directory

    // If the adapter may call process.exit during startup, define here which exit codes are allowed.
    // By default, 0 is ok. Providing this option overrides the default.
    // Make sure to include 0 if other exit codes are allowed aswell.
    allowedExitCodes: [11],
    
    // optionally define which modules should be mocked.
    additionalMockedModules: {
        "noble": nobleMock,
        "@abandonware/noble": nobleMock,
    }
});
```

### Basic adapter startup test (with live JS-Controller)
**TODO:** This is not supported yet and has to be converted from the existing tests.
The syntax will probably look very similar to the offline tests:
```ts
const path = require("path");
const { tests } = require("@iobroker/testing");

// Run tests
tests.live.adapterStartup(path.join(__dirname, ".."), {
    //                    ~~~~~~~~~~~~~~~~~~~~~~~~~
    // This should be the adapter's root directory

    // If the adapter may call process.exit during startup, define here which exit codes are allowed.
    // By default, 0 is ok. Providing this option overrides the default.
    // Make sure to include 0 if other exit codes are allowed aswell.
    allowedExitCodes: [11]
});
```


### Build your own tests (offline)
Take a look at `src/lib/startMockAdapter.ts` to get an idea how to test the adapter against a mock database with all the necessary objects in place.

**TODO:** An API for simplified usage is in the works.
<!--Here's an example how this can be used in a unit test. Note that this will not be the final syntax:
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
```-->
