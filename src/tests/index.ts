import { validatePackageFiles } from "./packageFiles";
import { testAdapterStartupWithMocks } from "./unit/adapterStartup";

export const tests = {
	unit: {
		adapterStartup: testAdapterStartupWithMocks,
	},
	packageFiles: validatePackageFiles,
};
