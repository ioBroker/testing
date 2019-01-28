# @iobroker/testing

This repo provides utilities for "offline" (without a running JS-Controller) testing of adapters and other ioBroker-related modules. It contains the following:
* A mock database which implements the most basic functionality of `ioBroker`'s Objects and States DB by operating on `Map` objects.
* A mock `Adapter` that is connected to the mock database. It implements basic functionality of the real `Adapter` class, but only operates on the mock database.
* Predefined unit tests using `mocha` and `chai` to be used in every adapter.

## Usage
TODO