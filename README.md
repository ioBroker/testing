# @iobroker/testing

This repo provides utilities for testing of ioBroker adapters and other ioBroker-related modules. It supports:
* **Unit tests** using mocks (without a running JS-Controller)
* **Integration tests** that test against a running JS-Controller instance.

The unit tests are realized using the following tools that are provided by this module:
* A mock database which implements the most basic functionality of `ioBroker`'s Objects and States DB by operating on `Map` objects.
* A mock `Adapter` that is connected to the mock database. It implements basic functionality of the real `Adapter` class, but only operates on the mock database.

Predefined methods for both unit and integration tests are exported.

## Usage

### Adapter startup (Unit test)
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
tests.unit.adapterStartup(path.join(__dirname, ".."), {
    //                    ~~~~~~~~~~~~~~~~~~~~~~~~~
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

    // Define your own tests inside defineAdditionalTests
    // Since the tests are heavily instrumented, you need to create and use a so called "harness" to control the tests.
    defineAdditionalTests: (getHarness) => {

        describe("Test sendTo()", () => {

            it("Should work", () => {
                return new Promise(async (resolve) => {
                    // Create a fresh harness instance each test!
                    const harness = getHarness();
                    // Start the adapter and wait until it has started
                    await harness.startAdapterAndWait();

                    // Perform the actual test:
                    harness.sendTo("adapter.0", "test", "message", (resp) => {
                        console.dir(resp);
                        resolve();
                    });
                });
            });

        })
    }
});
```


### Build your own unit tests
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
