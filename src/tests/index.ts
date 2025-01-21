import { testAdapter } from './integration';
import { validatePackageFiles } from './packageFiles';
import { testAdapterWithMocks } from './unit';
import { createMocks } from './unit/harness/createMocks';
import { createAsserts } from './unit/mocks/mockDatabase';

export { TestHarness as IntegrationTestHarness } from './integration/lib/harness';
export { MockAdapter } from './unit/mocks/mockAdapter';
export { MockDatabase } from './unit/mocks/mockDatabase';

/** Predefined test sets */
export const tests = {
    /** @deprecated Adapter startup unit tests are no longer supported */
    unit: testAdapterWithMocks,
    integration: testAdapter,
    packageFiles: validatePackageFiles,
};

/** Utilities for your own tests */
export const utils = {
    unit: {
        createMocks,
        createAsserts,
        /** @deprecated Adapter startup unit tests are no longer supported */
        startMockAdapter: () => ({}),
    },
};
