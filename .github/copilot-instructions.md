# @iobroker/testing Library

@iobroker/testing is a TypeScript library that provides utilities for testing ioBroker adapters and modules. It supports both unit tests (with mocks) and integration tests (against real JS-Controller instances).

**Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Bootstrap and Build
- Install dependencies: `npm install` -- takes ~1 second when up to date, may show audit warnings
- Build the project: `npm run build` -- takes ~2.1 seconds. NEVER CANCEL. Set timeout to 10+ minutes.
- Run type check without emit: `npm run check` -- takes ~2.1 seconds  
- Start watch mode for development: `npm run watch` -- starts TypeScript compiler in watch mode

### Testing
- Run all tests: `npm test` -- takes ~2.0 seconds. NEVER CANCEL. Set timeout to 10+ minutes.
- Start test watch mode: `npm run test:watch` -- starts Mocha in watch mode
- Tests are located in `src/**/*.test.ts` and use Mocha with Chai assertions

### Code Quality
- Lint TypeScript: `npm run lint` -- takes ~5.4 seconds
- **ALWAYS** run `npm run lint` before committing changes or CI will fail
- ESLint configuration in `eslint.config.mjs` using @iobroker/eslint-config

### Development Workflow
1. Make changes to TypeScript files in `src/`
2. Run `npm run build` to compile to `build/` directory
3. Run `npm test` to validate changes
4. Run `npm run lint` to ensure code quality
5. **ALWAYS** add a changelog entry to `CHANGELOG.md` under the "**WORK IN PROGRESS**" section for any user-facing changes
6. Built files in `build/` are what get published to npm

### Changelog Guidelines
- **REQUIRED**: Add an entry to `CHANGELOG.md` for all feature additions, bug fixes, or behavioral changes
- Format: `* (@username/@copilot) Description of change`
- Add entries under the `## **WORK IN PROGRESS**` section
- Be concise and describe the change from a user's perspective
- Examples:
  - `* (@Apollon77/@copilot) Add validation for JSON files in admin/ and admin/i18n/ directories`
  - `* (@Apollon77/@copilot) Re-enabled validation checks for README.md and LICENSE files in packageFiles tests`

## Project Structure

### Key Directories
- `src/` - TypeScript source code
  - `src/tests/` - Main testing functionality
    - `src/tests/integration/` - Integration test framework
    - `src/tests/unit/` - Unit test mocks and utilities  
    - `src/tests/packageFiles/` - Package validation tests
  - `src/lib/` - Shared utilities and tools
- `build/` - Compiled JavaScript output (created by TypeScript compiler)
- `test/` - Example test fixtures and setup
- `.github/workflows/` - CI/CD pipeline definitions

### Important Files
- `package.json` - Project dependencies and npm scripts
- `tsconfig.json` - TypeScript configuration for development
- `tsconfig.build.json` - TypeScript configuration for building
- `.mocharc.json` - Mocha test configuration
- `test/mocha.setup.js` - Test environment setup

## Validation
- **ALWAYS** test your changes by running the full build and test suite
- The library exports testing utilities that other projects consume
- Integration tests may take longer as they spawn real JS-Controller instances
- **REQUIRED**: Run `npm run check && npm run lint && npm run build && npm test` for complete validation -- takes ~11.6 seconds total
- **CRITICAL TIMING**: Full validation workflow takes under 12 seconds. NEVER CANCEL. Set timeout to 15+ minutes for safety.

### Manual Validation Scenarios
After making changes, **ALWAYS** validate that the library works correctly:

1. **Test Library Exports**: Create a test script to verify exports work:
   ```js
   const { tests, utils } = require('./build/index.js');
   console.log('Tests:', Object.keys(tests)); // Should show: unit, integration, packageFiles
   console.log('Utils:', Object.keys(utils)); // Should show: unit
   ```

2. **Test Mock Creation**: Verify mocks can be created:
   ```js
   const { database, adapter } = utils.unit.createMocks();
   // Should not throw errors and return objects
   ```

3. **Test Watch Modes**: 
   - Start `npm run watch` and verify it recompiles on file changes (~2 seconds)
   - Start `npm run test:watch` and verify it reruns tests on changes
   - Both should detect changes and reprocess automatically

4. **Integration Test Readiness**: While you cannot run full integration tests in this environment (they require JS-Controller), verify that the integration test utilities exist and are exportable.

## Common Tasks

### Making Changes to Testing Framework
1. Modify source files in `src/tests/`
2. Run `npm run build` to compile changes
3. Test changes with `npm test`
4. Validate with example usage if possible

### Adding New Test Utilities
1. Add TypeScript files to appropriate subdirectory in `src/`
2. Export new functionality from `src/tests/index.ts`
3. Add unit tests for new functionality
4. Update exports in main index files as needed

### Working with Integration Tests
- Integration tests install and run actual JS-Controller instances
- They may require longer timeouts for installation and startup
- Test harnesses provide controlled environments for adapter testing

## CI/CD Pipeline
- GitHub Actions workflow in `.github/workflows/test-and-release.yml`
- Runs on Node.js 18.x, 20.x, 22.x on Ubuntu
- Steps: install → type check → lint → test → deploy (on version tags)
- Publishes to NPM when version tags are pushed

## Dependencies Management
- Core dependencies: mocha, chai, sinon for testing framework
- Dev dependencies: TypeScript, ESLint, build tools
- Exports type definitions for chai, mocha, sinon to consuming projects
- Uses @iobroker/types for ioBroker-specific type definitions

## Library Usage Examples
The library exports `tests.packageFiles()`, `tests.integration()`, and `tests.unit()` for adapter developers to validate their adapters. See README.md for detailed usage examples.

## Environment Considerations
- **NEVER** run integration tests in a sandboxed environment - they require full JS-Controller setup
- Integration tests create temporary test directories and spawn actual ioBroker processes
- Unit tests with mocks work in any environment and run quickly
- The library itself is a development dependency for ioBroker adapter projects