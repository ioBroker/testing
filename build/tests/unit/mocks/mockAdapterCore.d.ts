import { type MockAdapter } from './mockAdapter';
import type { MockDatabase } from './mockDatabase';
export interface MockAdapterCoreOptions {
    onAdapterCreated?: (adapter: MockAdapter) => void;
    adapterDir?: string;
}
export declare function mockAdapterCore(database: MockDatabase, options?: MockAdapterCoreOptions): {
    controllerDir: string;
    getConfig: () => Record<string, any>;
    Adapter: (this: MockAdapter | void, nameOrOptions: string | ioBroker.AdapterOptions) => MockAdapter;
    adapter: (this: MockAdapter | void, nameOrOptions: string | ioBroker.AdapterOptions) => MockAdapter;
    getAbsoluteDefaultDataDir: () => string;
    getAbsoluteInstanceDataDir: (adapterObject: MockAdapter) => string;
};
