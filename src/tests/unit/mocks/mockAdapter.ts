import { extend, values } from "alcalzone-shared/objects";
import { stub } from "sinon";
import type { MockDatabase } from "./mockDatabase";
import { createLoggerMock, MockLogger } from "./mockLogger";
import {
	doResetBehavior,
	doResetHistory,
	ImplementedMethodDictionary,
	Mock,
	stubAndPromisifyImplementedMethods,
} from "./tools";

// The mocked adapter interface has all the usual properties, but all methods are replaced with stubs
export type MockAdapter = Mock<ioBroker.Adapter> & {
	readyHandler: ioBroker.ReadyHandler | undefined;
	objectChangeHandler: ioBroker.ObjectChangeHandler | undefined;
	stateChangeHandler: ioBroker.StateChangeHandler | undefined;
	messageHandler: ioBroker.MessageHandler | undefined;
	unloadHandler: ioBroker.UnloadHandler | undefined;

	log: MockLogger;

	resetMock(): void;
	resetMockHistory(): void;
	resetMockBehavior(): void;
};

// Define here which methods were implemented manually, so we can hook them up with a real stub
// The value describes if and how the async version of the callback is constructed
const implementedMethods: ImplementedMethodDictionary<ioBroker.Adapter> = {
	getObject: "normal",
	setObject: "normal",
	setObjectNotExists: "normal",
	extendObject: "normal",
	getForeignObject: "normal",
	getForeignObjects: "normal",
	setForeignObject: "normal",
	setForeignObjectNotExists: "normal",
	extendForeignObject: "normal",
	getState: "normal",
	getStates: "normal",
	setState: "normal",
	setStateChanged: "normal",
	delState: "normal",
	getForeignState: "normal",
	setForeignState: "normal",
	setForeignStateChanged: "normal",
	subscribeStates: "normal",
	subscribeForeignStates: "normal",
	subscribeObjects: "normal",
	subscribeForeignObjects: "normal",
	getAdapterObjects: "no error",
	getObjectView: "normal",
	getObjectList: "normal",
	on: "none",
	removeListener: "none",
	removeAllListeners: "none",
	terminate: "none",
	getPort: "no error",
	checkPassword: "no error",
	setPassword: "normal",
	checkGroup: "no error",
	calculatePermissions: "no error",
	getCertificates: "normal",
	sendTo: "no error",
	sendToHost: "no error",
	getHistory: "normal",
	// @ts-expect-error This method was deprecated
	setBinaryState: "normal",
	getBinaryState: "normal",
	getEnum: "normal",
	getEnums: "normal",
	addChannelToEnum: "normal",
	deleteChannelFromEnum: "normal",
	addStateToEnum: "normal",
	deleteStateFromEnum: "normal",
	createDevice: "normal",
	deleteDevice: "normal",
	createChannel: "normal",
	deleteChannel: "normal",
	createState: "normal",
	deleteState: "normal",
	getDevices: "normal",
	getChannelsOf: "normal",
	getStatesOf: "normal",
	readDir: "normal",
	mkDir: "normal",
	readFile: "normal",
	writeFile: "normal",
	delFile: "normal",
	unlink: "normal",
	rename: "normal",
	chmodFile: "normal",
};

function getCallback<T extends (...args: any[]) => any>(
	...args: any[]
): T | undefined {
	const lastArg = args[args.length - 1];
	if (typeof lastArg === "function") return lastArg as T;
}

/** Stub implementation which can be promisified */
const asyncEnabledStub = ((...args: any[]) => {
	const callback = getCallback(...args);
	if (typeof callback === "function") callback();
}) as sinon.SinonStub;

/**
 * Creates an adapter mock that is connected to a given database mock
 */
export function createAdapterMock(
	this: MockAdapter | void,
	db: MockDatabase,
	options: Partial<ioBroker.AdapterOptions> = {},
): MockAdapter {
	// In order to support ES6-style adapters with inheritance, we need to work on the instance directly
	const ret: MockAdapter = this || ({} as any);
	Object.assign(ret, {
		name: options.name || "test",
		host: "testhost",
		instance: options.instance || 0,
		namespace: `${options.name || "test"}.${options.instance || 0}`,
		config: options.config || {},
		common: {},
		systemConfig: null,
		adapterDir: "",
		ioPack: {},
		pack: {},
		log: createLoggerMock(),
		version: "any",
		connected: true,

		getPort: asyncEnabledStub,
		stop: stub(),

		checkPassword: asyncEnabledStub,
		setPassword: asyncEnabledStub,
		checkGroup: asyncEnabledStub,
		calculatePermissions: asyncEnabledStub,
		getCertificates: asyncEnabledStub,

		sendTo: asyncEnabledStub,
		sendToHost: asyncEnabledStub,

		idToDCS: stub(),

		getObject: ((id: string, ...args: any[]) => {
			if (!id.startsWith(ret.namespace)) id = ret.namespace + "." + id;
			const callback = getCallback<ioBroker.GetObjectCallback>(...args);
			if (callback) callback(null, db.getObject(id));
		}) as sinon.SinonStub,
		setObject: ((id: string, obj: ioBroker.Object, ...args: any[]) => {
			if (!id.startsWith(ret.namespace)) id = ret.namespace + "." + id;
			obj._id = id;
			db.publishObject(obj);
			const callback = getCallback<ioBroker.SetObjectCallback>(...args);
			if (callback) callback(null, { id });
		}) as sinon.SinonStub,
		setObjectNotExists: ((
			id: string,
			obj: ioBroker.Object,
			...args: any[]
		) => {
			if (!id.startsWith(ret.namespace)) id = ret.namespace + "." + id;
			const callback = getCallback<ioBroker.SetObjectCallback>(...args);
			if (db.hasObject(id)) {
				if (callback) callback(null, { id });
			} else {
				ret.setObject(id, obj, callback);
			}
		}) as sinon.SinonStub,
		getAdapterObjects: ((
			callback: (objects: Record<string, ioBroker.Object>) => void,
		) => {
			callback(db.getObjects(`${ret.namespace}.*`));
		}) as sinon.SinonStub,

		getObjectView: ((
			design: string,
			search: string,
			{ startkey, endkey }: { startkey?: string; endkey?: string },
			...args: any[]
		) => {
			if (design !== "system") {
				throw new Error(
					"If you want to use a custom design for getObjectView, you need to mock it yourself!",
				);
			}
			const callback = getCallback<
				ioBroker.GetObjectViewCallback<ioBroker.Object>
			>(...args);
			if (typeof callback === "function") {
				let objects = values(db.getObjects("*"));
				objects = objects.filter((obj) => obj.type === search);
				if (startkey)
					objects = objects.filter((obj) => obj._id >= startkey);
				if (endkey)
					objects = objects.filter((obj) => obj._id <= endkey);
				callback(null, {
					rows: objects.map((obj) => ({
						id: obj._id,
						value: obj,
					})),
				});
			}
		}) as sinon.SinonStub,

		getObjectList: ((
			{
				startkey,
				endkey,
				include_docs,
			}: {
				startkey?: string;
				endkey?: string;
				include_docs?: boolean;
			},
			...args: any[]
		) => {
			const callback = getCallback<ioBroker.GetObjectListCallback<ioBroker.Object>>(
				...args,
			);

			if (typeof callback === "function") {
				let objects = values(db.getObjects("*"));
				if (startkey)
					objects = objects.filter((obj) => obj._id >= startkey);
				if (endkey)
					objects = objects.filter((obj) => obj._id <= endkey);
				if (!include_docs)
					objects = objects.filter((obj) => !obj._id.startsWith("_"));
				callback(null, {
					rows: objects.map((obj) => ({
						id: obj._id,
						value: obj,
						doc: obj,
					})),
				});
			}
		}) as sinon.SinonStub,

		extendObject: ((
			id: string,
			obj: ioBroker.PartialObject,
			...args: any[]
		) => {
			if (!id.startsWith(ret.namespace)) id = ret.namespace + "." + id;
			const existing = db.getObject(id) || {};
			const target = extend({}, existing, obj) as ioBroker.Object;
			target._id = id;
			db.publishObject(target);
			const callback = getCallback<ioBroker.ExtendObjectCallback>(
				...args,
			);
			if (callback) callback(null, { id: target._id, value: target }, id);
		}) as sinon.SinonStub,
		delObject: ((id: string, ...args: any[]) => {
			if (!id.startsWith(ret.namespace)) id = ret.namespace + "." + id;
			db.deleteObject(id);
			const callback = getCallback<ioBroker.ErrorCallback>(...args);
			if (callback) callback(undefined);
		}) as sinon.SinonStub,

		getForeignObject: ((id: string, ...args: any[]) => {
			const callback = getCallback<ioBroker.GetObjectCallback>(...args);
			if (callback) callback(null, db.getObject(id));
		}) as sinon.SinonStub,
		getForeignObjects: ((pattern: string, ...args: any[]) => {
			const type: ioBroker.ObjectType | undefined =
				typeof args[0] === "string"
					? (args[0] as ioBroker.ObjectType)
					: undefined;
			const callback = getCallback<ioBroker.GetObjectsCallback>(...args);
			if (callback) callback(null, db.getObjects(pattern, type));
		}) as sinon.SinonStub,
		setForeignObject: ((
			id: string,
			obj: ioBroker.Object,
			...args: any[]
		) => {
			obj._id = id;
			db.publishObject(obj);
			const callback = getCallback<ioBroker.SetObjectCallback>(...args);
			if (callback) callback(null, { id });
		}) as sinon.SinonStub,
		setForeignObjectNotExists: ((
			id: string,
			obj: ioBroker.Object,
			...args: any[]
		) => {
			const callback = getCallback<ioBroker.SetObjectCallback>(...args);
			if (db.hasObject(id)) {
				if (callback) callback(null, { id });
			} else {
				ret.setObject(id, obj, callback);
			}
		}) as sinon.SinonStub,
		extendForeignObject: ((
			id: string,
			obj: ioBroker.PartialObject,
			...args: any[]
		) => {
			const target = db.getObject(id) || ({} as ioBroker.Object);
			Object.assign(target, obj);
			target._id = id;
			db.publishObject(target);
			const callback = getCallback<ioBroker.ExtendObjectCallback>(
				...args,
			);
			if (callback) callback(null, { id: target._id, value: target }, id);
		}) as sinon.SinonStub,
		findForeignObject: stub(),
		delForeignObject: ((id: string, ...args: any[]) => {
			db.deleteObject(id);
			const callback = getCallback<ioBroker.ErrorCallback>(...args);
			if (callback) callback(undefined);
		}) as sinon.SinonStub,

		setState: ((id: string, state: any, ...args: any[]) => {
			const callback = getCallback<ioBroker.SetStateCallback>(...args);

			if (!id.startsWith(ret.namespace)) id = ret.namespace + "." + id;

			let ack: boolean;
			if (state != null && typeof state === "object") {
				ack = !!state.ack;
				state = state.val;
			} else {
				ack = typeof args[0] === "boolean" ? args[0] : false;
			}

			db.publishState(id, { val: state, ack });
			if (callback) callback(null, id);
		}) as sinon.SinonStub,
		setStateChanged: ((id: string, state: any, ...args: any[]) => {
			const callback = getCallback<ioBroker.SetStateCallback>(...args);

			let ack: boolean;
			if (state != null && typeof state === "object") {
				ack = !!state.ack;
				state = state.val;
			} else {
				ack = typeof args[0] === "boolean" ? args[0] : false;
			}

			if (!id.startsWith(ret.namespace)) id = ret.namespace + "." + id;
			if (!db.hasState(id) || db.getState(id)!.val !== state) {
				db.publishState(id, { val: state, ack });
			}
			if (callback) callback(null, id);
		}) as sinon.SinonStub,
		setForeignState: ((id: string, state: any, ...args: any[]) => {
			const callback = getCallback<ioBroker.SetStateCallback>(...args);

			let ack: boolean;
			if (state != null && typeof state === "object") {
				ack = !!state.ack;
				state = state.val;
			} else {
				ack = typeof args[0] === "boolean" ? args[0] : false;
			}

			db.publishState(id, { val: state, ack });
			if (callback) callback(null, id);
		}) as sinon.SinonStub,
		setForeignStateChanged: ((id: string, state: any, ...args: any[]) => {
			const callback = getCallback<ioBroker.SetStateCallback>(...args);

			let ack: boolean;
			if (state != null && typeof state === "object") {
				ack = !!state.ack;
				state = state.val;
			} else {
				ack = typeof args[0] === "boolean" ? args[0] : false;
			}

			if (!db.hasState(id) || db.getState(id)!.val !== state) {
				db.publishState(id, { val: state, ack });
			}
			if (callback) callback(null, id);
		}) as sinon.SinonStub,

		getState: ((id: string, ...args: any[]) => {
			if (!id.startsWith(ret.namespace)) id = ret.namespace + "." + id;
			const callback = getCallback<ioBroker.GetStateCallback>(...args);
			if (callback) callback(null, db.getState(id));
		}) as sinon.SinonStub,
		getForeignState: ((id: string, ...args: any[]) => {
			const callback = getCallback<ioBroker.GetStateCallback>(...args);
			if (callback) callback(null, db.getState(id));
		}) as sinon.SinonStub,
		getStates: ((pattern: string, ...args: any[]) => {
			if (!pattern.startsWith(ret.namespace))
				pattern = ret.namespace + "." + pattern;
			const callback = getCallback<ioBroker.GetStatesCallback>(...args);
			if (callback) callback(null, db.getStates(pattern));
		}) as sinon.SinonStub,
		getForeignStates: ((pattern: string, ...args: any[]) => {
			const callback = getCallback<ioBroker.GetStatesCallback>(...args);
			if (callback) callback(null, db.getStates(pattern));
		}) as sinon.SinonStub,

		delState: ((id: string, ...args: any[]) => {
			if (!id.startsWith(ret.namespace)) id = ret.namespace + "." + id;
			db.deleteState(id);
			const callback = getCallback<ioBroker.ErrorCallback>(...args);
			if (callback) callback(undefined);
		}) as sinon.SinonStub,
		delForeignState: ((id: string, ...args: any[]) => {
			db.deleteState(id);
			const callback = getCallback<ioBroker.ErrorCallback>(...args);
			if (callback) callback(undefined);
		}) as sinon.SinonStub,

		getHistory: asyncEnabledStub,

		setBinaryState: asyncEnabledStub,
		getBinaryState: asyncEnabledStub,

		getEnum: asyncEnabledStub,
		getEnums: asyncEnabledStub,

		addChannelToEnum: asyncEnabledStub,
		deleteChannelFromEnum: asyncEnabledStub,

		addStateToEnum: asyncEnabledStub,
		deleteStateFromEnum: asyncEnabledStub,

		subscribeObjects: asyncEnabledStub,
		subscribeForeignObjects: asyncEnabledStub,
		unsubscribeObjects: asyncEnabledStub,
		unsubscribeForeignObjects: asyncEnabledStub,

		subscribeStates: asyncEnabledStub,
		subscribeForeignStates: asyncEnabledStub,
		unsubscribeStates: asyncEnabledStub,
		unsubscribeForeignStates: asyncEnabledStub,

		createDevice: asyncEnabledStub,
		deleteDevice: asyncEnabledStub,
		createChannel: asyncEnabledStub,
		deleteChannel: asyncEnabledStub,
		createState: asyncEnabledStub,
		deleteState: asyncEnabledStub,

		getDevices: asyncEnabledStub,
		getChannels: stub(),
		getChannelsOf: asyncEnabledStub,
		getStatesOf: asyncEnabledStub,

		readDir: asyncEnabledStub,
		mkDir: asyncEnabledStub,

		readFile: asyncEnabledStub,
		writeFile: asyncEnabledStub,

		delFile: asyncEnabledStub,
		unlink: asyncEnabledStub,

		rename: asyncEnabledStub,

		chmodFile: asyncEnabledStub,

		formatValue: stub(),
		formatDate: stub(),

		terminate: ((reason?: string | number, exitCode?: number) => {
			if (typeof reason === "number") {
				// Only the exit code was passed
				exitCode = reason;
				reason = undefined;
			}

			const errorMessage = `Adapter.terminate was called${
				typeof exitCode === "number" ? ` (exit code ${exitCode})` : ""
			}: ${reason ? reason : "Without reason"}`;
			// Terminates execution by
			const err = new Error(errorMessage);
			// @ts-expect-error I'm too lazy to add terminateReason to the error type
			err.terminateReason = reason || "no reason given!";
			throw err;
		}) as any as sinon.SinonStub,

		supportsFeature: stub(),
		getPluginInstance: stub(),
		getPluginConfig: stub(),

		// EventEmitter methods
		on: ((event: string, handler: (...args: any[]) => void) => {
			// Remember the event handlers so we can call them on demand
			switch (event) {
				case "ready":
					ret.readyHandler = handler;
					break;
				case "message":
					ret.messageHandler = handler;
					break;
				case "objectChange":
					ret.objectChangeHandler = handler;
					break;
				case "stateChange":
					ret.stateChangeHandler = handler;
					break;
				case "unload":
					ret.unloadHandler = handler;
					break;
			}
			return ret;
		}) as sinon.SinonStub,

		removeListener: ((
			event: string,
			_listener: (...args: any[]) => void,
		) => {
			// TODO This is not entirely correct
			switch (event) {
				case "ready":
					ret.readyHandler = undefined;
					break;
				case "message":
					ret.messageHandler = undefined;
					break;
				case "objectChange":
					ret.objectChangeHandler = undefined;
					break;
				case "stateChange":
					ret.stateChangeHandler = undefined;
					break;
				case "unload":
					ret.unloadHandler = undefined;
					break;
			}
			return ret;
		}) as sinon.SinonStub,

		removeAllListeners: ((event?: string) => {
			if (!event || event === "ready") {
				ret.readyHandler = undefined;
			}
			if (!event || event === "message") {
				ret.messageHandler = undefined;
			}
			if (!event || event === "objectChange") {
				ret.objectChangeHandler = undefined;
			}
			if (!event || event === "stateChange") {
				ret.stateChangeHandler = undefined;
			}
			if (!event || event === "unload") {
				ret.unloadHandler = undefined;
			}
			return ret;
		}) as sinon.SinonStub,

		// Mock-specific methods
		resetMockHistory() {
			// reset Adapter
			doResetHistory(ret);
			(ret.log as MockLogger).resetMockHistory();
		},
		resetMockBehavior() {
			// reset Adapter
			doResetBehavior(ret, implementedMethods);
			(ret.log as MockLogger).resetMockBehavior();
		},
		resetMock() {
			ret.resetMockHistory();
			ret.resetMockBehavior();
		},
	} as unknown as MockAdapter);

	stubAndPromisifyImplementedMethods(ret, implementedMethods, [
		"getObjectView",
		"getObjectList",
	]);

	// Access the options object directly, so we can react to later changes
	Object.defineProperties(ret, {
		readyHandler: {
			get(): typeof options.ready {
				return options.ready;
			},
			set(handler: typeof options.ready) {
				options.ready = handler;
			},
		},
		messageHandler: {
			get(): typeof options.message {
				return options.message;
			},
			set(handler: typeof options.message) {
				options.message = handler;
			},
		},
		objectChangeHandler: {
			get(): typeof options.objectChange {
				return options.objectChange;
			},
			set(handler: typeof options.objectChange) {
				options.objectChange = handler;
			},
		},
		stateChangeHandler: {
			get(): typeof options.stateChange {
				return options.stateChange;
			},
			set(handler: typeof options.stateChange) {
				options.stateChange = handler;
			},
		},
		unloadHandler: {
			get(): typeof options.unload {
				return options.unload;
			},
			set(handler: typeof options.unload) {
				options.unload = handler;
			},
		},
	});

	return ret;
}
