import { validatePackageFiles } from "./package/packageFiles";
import { testAdapterStartupWithMocks } from "./unit/adapterStartup";
export declare const tests: {
    unit: {
        adapterStartup: typeof testAdapterStartupWithMocks;
    };
    packageFiles: typeof validatePackageFiles;
};
