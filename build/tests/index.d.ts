import { validatePackageFiles } from "./packageFiles";
import { testAdapterStartupWithMocks } from "./unit/adapterStartup";
export declare const tests: {
    unit: {
        adapterStartup: typeof testAdapterStartupWithMocks;
    };
    packageFiles: typeof validatePackageFiles;
};
