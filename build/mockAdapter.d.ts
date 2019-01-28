/// <reference types="iobroker" />
/// <reference types="sinon" />
import { Equals, Overwrite } from "alcalzone-shared/types";
import { MockDatabase } from "./mockDatabase";
export declare type IsAny<T> = Equals<T extends never ? false : true, boolean>;
export declare type MockableMethods<All = Required<ioBroker.Adapter>, NoAny = {
    [K in keyof All]: IsAny<All[K]> extends true ? never : All[K] extends Function ? K : never;
}> = NoAny[keyof NoAny];
export declare type MockAdapter = Overwrite<ioBroker.Adapter, {
    [K in MockableMethods]: sinon.SinonStub;
}> & {
    resetMock(): void;
    resetMockHistory(): void;
    resetMockBehavior(): void;
};
/**
 * Creates an adapter mock that is connected to a given database mock
 */
export declare function createAdapterMock(db: MockDatabase): MockAdapter;
