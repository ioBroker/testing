import { promisify, promisifyNoError } from "alcalzone-shared/async";
import { Equals, Overwrite } from "alcalzone-shared/types";
import { stub } from "sinon";

// IsAny exploits the fact that `any` may or may not be assignable to `never`, whereas all other types are
export type IsAny<T> = Equals<T extends never ? false : true, boolean>;

// This rather complicated type extracts all functions from the given interface without including the properties that are `any`
// It basically is `getObject | setObject | ...`
export type MockableMethods<
	T,
	All = Required<T>,
	NoAny = {
		[K in keyof All]:
		IsAny<All[K]> extends true ? never
		: All[K] extends ((...args: any[]) => void) ? K
		: never
	}
	> = NoAny[keyof NoAny];

export type Mock<T> = Overwrite<T, { [K in MockableMethods<T>]: sinon.SinonStub }>;

export function doResetHistory(parent: Record<string, any>) {
	for (const prop of Object.keys(parent)) {
		const val = parent[prop];
		if (val && typeof val.resetHistory === "function") val.resetHistory();
	}
}

export function doResetBehavior(parent: Record<string, any>, implementedMethods: Record<string, any>) {
	for (const prop of Object.keys(parent)) {
		if (prop in implementedMethods || (
			prop.endsWith("Async") && prop.slice(0, -5) in implementedMethods
		)) continue;
		const val = parent[prop];
		if (val && typeof val.resetBehavior === "function") val.resetBehavior();
	}
}

const dontOverwriteThis = () => { throw new Error("You must not overwrite the behavior of this stub!"); };

export function stubAndPromisifyImplementedMethods<T extends string>(
	parent: Record<T, any>,
	implementedMethods: Partial<Record<T, any>>,
	allowUserOverrides: T[] = [],
) {
	// The methods implemented above are no stubs, but we claimed they are
	// Therefore hook them up with a real stub
	for (const methodName of Object.keys(implementedMethods) as T[]) {
		if (methodName.endsWith("Async")) continue;

		const originalMethod = parent[methodName];
		const callbackFake = parent[methodName] = stub();
		callbackFake.callsFake(originalMethod);
		// Prevent the user from changing the stub's behavior
		if (allowUserOverrides.indexOf(methodName) === -1) {
			callbackFake.returns = dontOverwriteThis;
			callbackFake.callsFake = dontOverwriteThis;
		}

		// Construct the async fake if there's any
		const asyncType = implementedMethods[methodName];
		if (asyncType === "none") continue;
		const promisifyMethod = asyncType === "no error" ? promisifyNoError : promisify;
		const asyncFake = stub().callsFake(promisifyMethod<any>(originalMethod, parent));
		parent[`${methodName}Async` as T] = asyncFake;
		// Prevent the user from changing the stub's behavior
		if (allowUserOverrides.indexOf(methodName) === -1 || allowUserOverrides.indexOf(methodName + "Async" as T) === -1) {
			asyncFake.returns = dontOverwriteThis;
			asyncFake.callsFake = dontOverwriteThis;
		}
	}
}

export type ImplementedMethodDictionary<T> = Partial<Record<MockableMethods<T>, "none" | "normal" | "no error">>;
