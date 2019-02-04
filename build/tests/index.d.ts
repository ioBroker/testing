import { testAdapter } from "./integration";
import { validatePackageFiles } from "./packageFiles";
import { testAdapterStartupWithMocks } from "./unit/adapterStartup";
export { TestHarness as IntegrationTestHarness } from "./integration/lib/harness";
export declare const tests: {
    unit: {
        adapterStartup: typeof testAdapterStartupWithMocks;
    };
    integration: typeof testAdapter;
    packageFiles: typeof validatePackageFiles;
};
