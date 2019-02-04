import { testAdapter } from "./integration";
import { validatePackageFiles } from "./packageFiles";
import { testAdapterStartupWithMocks } from "./unit/adapterStartup";

export { TestHarness as IntegrationTestHarness } from "./integration/lib/harness";

export const tests = {
	unit: {
		adapterStartup: testAdapterStartupWithMocks,
	},
	integration: testAdapter,
	packageFiles: validatePackageFiles,
};
