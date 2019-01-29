/// <reference types="iobroker" />
import { MockAdapter } from "./mockAdapter";
import { MockDatabase } from "./mockDatabase";
interface MockAdapterConstructor {
    new (nameOrOptions: string | ioBroker.AdapterOptions): MockAdapter;
    (nameOrOptions: string | ioBroker.AdapterOptions): MockAdapter;
}
export declare function mockAdapterCore(database: MockDatabase, onAdapterCreated: (adapter: MockAdapter) => void): {
    controllerDir: string;
    getConfig: () => Record<string, any>;
    Adapter: MockAdapterConstructor;
    adapter: MockAdapterConstructor;
};
export {};
