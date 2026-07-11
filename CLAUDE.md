# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@iobroker/testing` is an npm library that ioBroker adapter developers depend on to test their adapters. It is **not** an application — the code here is consumed by other projects' Mocha test suites. Everything under `src/` compiles to `build/`, and only `build/` is published.

The public API is defined in `src/tests/index.ts` and re-exported from `src/index.ts`:
- `tests.integration(adapterDir, options)` — start an adapter against a real JS-Controller and run tests against it
- `tests.packageFiles(adapterDir)` — validate `package.json` / `io-package.json` / other package files
- `tests.unit` — **deprecated**, now a no-op that only runs user-defined tests
- `utils.unit.createMocks()` / `utils.unit.createAsserts()` — mock DB + mock adapter for writing your own unit tests

## Commands

```bash
npm run build        # compile src/ -> build/ via tsconfig.build.json (this is what gets published)
npm run watch        # tsc --watch
npm run check        # type-check only (build with --noEmit)
npm test             # run all Mocha tests: src/**/*.test.ts
npm run test:watch   # Mocha --watch
npm run lint         # eslint via eslint.config.mjs (@iobroker/eslint-config)
```

Run a single test file: `npx mocha "src/lib/adapterTools.test.ts"` (mocha config in `.mocharc.json` wires up `ts-node/register`).

Full pre-commit validation used by CI (`.github/workflows/test-and-release.yml`, Node 18/20/22):
```bash
npm run check && npm run lint && npm run build && npm test
```

The library's own tests are pure unit tests (no JS-Controller) and run in a few seconds. **Do not attempt to run `tests.integration` from within this repo or a sandbox** — it downloads, installs, and spawns a real JS-Controller into `os.tmpdir()`.

## Changelog requirement

For any user-facing change, add an entry to `CHANGELOG.md` under the `## **WORK IN PROGRESS**` section (create that heading from the placeholder comment at the top if it isn't there). Format: `* (@username) Description from the user's perspective`. Releases are cut with `npm run release` (@alcalzone/release-script).

## Architecture

### Integration testing (`src/tests/integration/`)

This is the core of the library. `testAdapter()` in `integration/index.ts` builds a Mocha tree using `describe`/`before`/`beforeEach`/`after` hooks. The lifecycle:

1. **`prepareTests` (once, `before`)** — creates a test dir at `os.tmpdir()/test-<appName>.<adapterName>`, uses `ControllerSetup` to install + configure JS-Controller, then `AdapterSetup` to install the adapter under test, then snapshots the objects/states DBs into in-memory backups.
2. **`resetDbAndStartHarness` (before each suite/startup test)** — restores the DB backups, clears DB/log dirs, and constructs a fresh `TestHarness`. Every test gets a clean environment.
3. **`shutdownTests` (after)** — stops the controller and adapter.

The collaborating classes in `integration/lib/`:
- **`TestHarness`** (`harness.ts`) — an `EventEmitter` that is the object user tests interact with. Spawns the adapter in a child process (`node`, or `node -r @alcalzone/esbuild-register` for `.ts` main files), monitors its `alive`/exit state, and exposes `startAdapter`, `startAdapterAndWait`, `stopAdapter`, `changeAdapterConfig`, `sendTo` (message-box emulation via `enableSendTo`), and direct `.objects` / `.states` DB access.
- **`DBConnection`** (`dbConnection.ts`) — wraps the objects and states DB servers + clients. Supports both `file` and `jsonl` DB types, and handles backup/restore used for test isolation.
- **`ControllerSetup`** / **`AdapterSetup`** — install and configure JS-Controller and the adapter into the temp test dir; `executeCommand` in `src/lib/` runs the npm/install subprocesses.

**The `suite()` construct** (see `integration/index.ts` and the README): user tests passed via `options.defineAdditionalTests` must be grouped inside `suite(name, getHarness => {...})`. Each suite resets the environment before and tears it down after all its tests. To enforce this, the global `it()` is replaced with a `Proxy` that throws if `it()` is called outside a suite. `suite.only` / `suite.skip` map to `describe.only` / `describe.skip`.

### Package-file validation (`src/tests/packageFiles/`)

`validatePackageFiles()` emits `it()` tests that check the presence/shape of `package.json`, `io-package.json`, and related files. Parses with JSON5 where adapters allow it; when a JSON file is itself invalid, subsequent tests that depend on it are skipped (tracked via the `invalidFiles` map) rather than cascading failures.

### Unit mocks (`src/tests/unit/`)

Still exported via `utils.unit`, even though adapter-startup unit tests are deprecated.
- **`mocks/mockDatabase.ts`** — `MockDatabase`, a `Map`-backed reimplementation of the Objects & States DB, plus `createAsserts()`.
- **`mocks/mockAdapter.ts`** — `createAdapterMock`, a sinon-stubbed `Adapter` wired to a `MockDatabase`; tracks call history (`resetMockHistory()`).
- **`mocks/mockAdapterCore.ts`**, **`mockLogger.ts`** — supporting mocks.
- **`harness/`** — module loader with support for faking modules and proxying globals (used by the removed startup harness).

### Shared lib (`src/lib/`)

`adapterTools.ts` is the key helper module: `loadNpmPackage`, `loadIoPackage`, `getAppName`, `getAdapterName`, `getAdapterExecutionMode`, and `locateAdapterMainFile` (resolves the adapter entry point, falling back `.js` → `.ts` → `<name>.js` → `<name>.ts`). These drive how the harness finds and launches the adapter.

## TypeScript config

- `tsconfig.json` — editor/type-check config, `noEmit`, extends `@tsconfig/node18` (module/moduleResolution `node16`, target `es2022`). The `ioBroker` and `Mocha` global type namespaces come from the `types` array (`@iobroker/types`, `@types/mocha`), not from a `paths` mapping.
- `tsconfig.build.json` — the build; emits declarations, excludes `*.test.ts`.

Requires TypeScript 6.x. Under TS6, `paths` values must be relative when `baseUrl` is unset — this repo has no `baseUrl` and no `paths`, relying on `types` for the ambient namespaces instead.

Types (`chai`, `mocha`, `sinon`, `@iobroker/types`) are intentionally in `dependencies` (not devDependencies) so consuming adapters inherit them.
