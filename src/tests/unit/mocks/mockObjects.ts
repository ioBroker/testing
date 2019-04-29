/* eslint-disable @typescript-eslint/camelcase */
import { values } from "alcalzone-shared/objects";
import { stub } from "sinon";
import { MockDatabase } from "./mockDatabase";
import {
	doResetBehavior,
	doResetHistory,
	ImplementedMethodDictionary,
	Mock,
	stubAndPromisifyImplementedMethods,
} from "./tools";

// The mocked objects interface has all the usual properties, but all methods are replaced with stubs
export type MockObjects = Mock<ioBroker.Objects> & {
	resetMock(): void;
	resetMockHistory(): void;
	resetMockBehavior(): void;
};

// Define here which methods were implemented manually, so we can hook them up with a real stub
// The value describes if and how the async version of the callback is constructed
const implementedMethods: ImplementedMethodDictionary<ioBroker.Objects> = {
	getObjectView: "normal",
	getObjectList: "normal",
};

/**
 * Creates an adapter mock that is connected to a given database mock
 */
export function createObjectsMock(db: MockDatabase): MockObjects {
	const ret = {
		getObjectView: ((
			design: string,
			search: string,
			{ startkey, endkey }: { startkey?: string; endkey?: string },
			callback?: ioBroker.GetObjectViewCallback,
		) => {
			if (design !== "system")
				throw new Error(
					"If you want to use a custom design for getObjectView, you need to mock it yourself!",
				);
			if (typeof callback === "function") {
				let objects = values(db.getObjects("*"));
				objects = objects.filter(obj => obj.type === search);
				if (startkey)
					objects = objects.filter(obj => obj._id >= startkey);
				if (endkey) objects = objects.filter(obj => obj._id <= endkey);
				callback(null, {
					rows: objects.map(obj => ({ id: obj._id, value: obj })),
				});
			}
		}) as sinon.SinonStub,

		getObjectList: ((
			{
				startkey,
				endkey,
				include_docs,
			}: { startkey?: string; endkey?: string; include_docs?: boolean },
			callback?: ioBroker.GetObjectListCallback,
		) => {
			if (typeof callback === "function") {
				let objects = values(db.getObjects("*"));
				if (startkey)
					objects = objects.filter(obj => obj._id >= startkey);
				if (endkey) objects = objects.filter(obj => obj._id <= endkey);
				if (!include_docs)
					objects = objects.filter(obj => !obj._id.startsWith("_"));
				callback(null, {
					rows: objects.map(obj => ({
						id: obj._id,
						value: obj,
						doc: obj,
					})),
				});
			}
		}) as sinon.SinonStub,

		// TODO: Find out which of those methods are used frequently.
		// All that are NOT should be given functionality by the user using method.returns(...) and similar
		getUserGroup: stub(),
		getMimeType: stub(),
		writeFile: stub(),
		readFile: stub(),
		unlink: stub(),
		delFile: stub(),
		readDir: stub(),
		rename: stub(),
		touch: stub(),
		rm: stub(),
		mkDir: stub(),
		chownFile: stub(),
		chmodFile: stub(),
		subscribeConfig: stub(),
		subscribe: stub(),
		unsubscribeConfig: stub(),
		unsubscribe: stub(),
		chownObject: stub(),
		chmodObject: stub(),
		getObject: stub(),
		getConfig: stub(),
		getConfigKeys: stub(),
		getObjects: stub(),
		getConfigs: stub(),
		setObject: stub(),
		setConfig: stub(),
		delObject: stub(),
		delConfig: stub(),
		extendObject: stub(),
		findObject: stub(),
		destroy: stub(),

		// Mock-specific methods
		resetMockHistory() {
			// reset Objects
			doResetHistory(ret);
		},
		resetMockBehavior() {
			// reset Objects
			doResetBehavior(ret, implementedMethods);
		},
		resetMock() {
			ret.resetMockHistory();
			ret.resetMockBehavior();
		},
	} as MockObjects;

	stubAndPromisifyImplementedMethods(ret, implementedMethods, [
		"getObjectView",
		"getObjectList",
	]);

	return ret;
}
