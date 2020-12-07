## Changelog

<!--
	PLACEHOLDER for next version:
	## __WORK IN PROGRESS__
-->

## __WORK IN PROGRESS__
* Unit tests for adapter startup were removed and only log a warning that you can remove them

## 2.3.0 (2020-08-20)
* Added missing async functions to adapter mock
* Fixed: `TypeError "Cannot redefine property readyHandler"` when using `createMocks` more than once
* Upgrade to `@types/iobroker` v3.0.12

## 2.2.0 (2020-04-15)
* Upgrade to `@types/iobroker` v3.0.2
* Added mocks for `supportsFeature`, `getPluginInstance`, `getPluginConfig`

## 2.1.0 (2020-03-01)
* **Integration tests:** For Node.js >= 10, the `engine-strict` flag is now set to `true` to be in line with newer ioBroker installations

## v2.0.2
* **Unit tests:** added mocks for `getAbsoluteDefaultDataDir` and `getAbsoluteInstanceDataDir`

Sorry, there isn't more yet.
