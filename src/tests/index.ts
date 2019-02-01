import { validatePackageFiles } from "./package/packageFiles";
import { testAdapterStartupWithMocks } from "./unit/adapterStartup";

export const tests = {
	unit: {
		adapterStartup: testAdapterStartupWithMocks,
	},
	packageFiles: validatePackageFiles,
};
