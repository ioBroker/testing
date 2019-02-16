import { stub } from "sinon";

import { extend } from "alcalzone-shared/objects";
import { MockDatabase } from "./mockDatabase";
import { doResetBehavior, doResetHistory, ImplementedMethodDictionary, Mock, MockableMethods, stubAndPromisifyImplementedMethods } from "./tools";
import { createLoggerMock, MockLogger } from "./mockLogger";
import { createObjectsMock, MockObjects } from "./mockObjects";

// The mocked adapter interface has all the usual properties, but all methods are replaced with stubs
export type MockAdapter = Mock<ioBroker.Adapter> & {
	readyHandler: ioBroker.ReadyHandler | undefined;
	objectChangeHandler: ioBroker.ObjectChangeHandler | undefined;
	stateChangeHandler: ioBroker.StateChangeHandler | undefined;
	messageHandler: ioBroker.MessageHandler | undefined;
	unloadHandler: ioBroker.UnloadHandler | undefined;

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
	getAdapterObjects: "no error",
};

/**
 * Creates an adapter mock that is connected to a given database mock
 */
export function createAdapterMock(db: MockDatabase, options: Partial<ioBroker.AdapterOptions> = {}) {
	const ret = {
		name: options.name || "test",
		host: "testhost",
		instance: options.instance || 0,
		namespace: `${options.name || "test"}.${options.instance || 0}`,
		config: {},
		common: {},
		systemConfig: null,
		adapterDir: "",
		ioPack: {},
		pack: {},
		log: createLoggerMock() as ioBroker.Logger,
		version: "any",
		states: {} as any as ioBroker.States,
		objects: createObjectsMock(db) as ioBroker.Objects,
		connected: true,

		getPort: stub(),
		stop: stub(),

		checkPassword: stub(),
		setPassword: stub(),
		checkGroup: stub(),
		calculatePermissions: stub(),
		getCertificates: stub(),

		sendTo: stub(),
		sendToHost: stub(),

		idToDCS: stub(),

		getObject: ((id: string, callback: ioBroker.GetObjectCallback) => {
			if (!id.startsWith(ret.namespace)) id = ret.namespace + "." + id;
			callback(null, db.getObject(id));
		}) as sinon.SinonStub,
		setObject: ((id: string, obj: ioBroker.Object, callback?: ioBroker.SetObjectCallback) => {
			if (!id.startsWith(ret.namespace)) id = ret.namespace + "." + id;
			obj._id = id;
			db.publishObject(obj);
			if (typeof callback === "function") callback(null, { id });
		}) as sinon.SinonStub,
		setObjectNotExists: ((id: string, obj: ioBroker.Object, callback?: ioBroker.SetObjectCallback) => {
			if (!id.startsWith(ret.namespace)) id = ret.namespace + "." + id;
			if (db.hasObject(id)) {
				if (typeof callback === "function") callback(null, { id });
			} else {
				ret.setObject(id, obj, callback);
			}
		}) as sinon.SinonStub,
		getAdapterObjects: ((callback: (objects: Record<string, ioBroker.Object>) => void) => {
			callback(db.getObjects(`${ret.namespace}.*`));
		}) as sinon.SinonStub,
		extendObject: ((id: string, obj: ioBroker.PartialObject, callback?: ioBroker.ExtendObjectCallback) => {
			if (!id.startsWith(ret.namespace)) id = ret.namespace + "." + id;
			const existing = db.getObject(id) || {};
			const target = extend({}, existing, obj) as ioBroker.Object;
			db.publishObject(target);
			if (typeof callback === "function") callback(null, { id: target._id, value: target }, id);
		}) as sinon.SinonStub,
		delObject: ((id: string, callback?: ioBroker.ErrorCallback) => {
			if (!id.startsWith(ret.namespace)) id = ret.namespace + "." + id;
			db.deleteObject(id);
			if (typeof callback === "function") callback(undefined);
		}) as sinon.SinonStub,

		getForeignObject: ((id: string, callback: ioBroker.GetObjectCallback) => {
			callback(null, db.getObject(id));
		}) as sinon.SinonStub,
		getForeignObjects: ((...args: any[] /*pattern: string, type: ioBroker.ObjectType */) => {
			const [pattern, type] = args as any as [string, ioBroker.ObjectType];
			const lastArg = args[args.length - 1];
			const callback: ioBroker.GetObjectsCallback | undefined = typeof lastArg === "function" ? lastArg : undefined;
			if (typeof callback === "function") callback(null, db.getObjects(pattern, type));
		}) as sinon.SinonStub,
		setForeignObject: ((id: string, obj: ioBroker.Object, callback?: ioBroker.SetObjectCallback) => {
			obj._id = id;
			db.publishObject(obj);
			if (typeof callback === "function") callback(null, { id });
		}) as sinon.SinonStub,
		setForeignObjectNotExists: ((id: string, obj: ioBroker.Object, callback?: ioBroker.SetObjectCallback) => {
			if (db.hasObject(id)) {
				if (typeof callback === "function") callback(null, { id });
			} else {
				ret.setObject(id, obj, callback);
			}
		}) as sinon.SinonStub,
		extendForeignObject: ((id: string, obj: ioBroker.PartialObject, callback?: ioBroker.ExtendObjectCallback) => {
			const target = db.getObject(id) || {} as ioBroker.Object;
			Object.assign(target, obj);
			db.publishObject(target);
			if (typeof callback === "function") callback(null, { id: target._id, value: target }, id);
		}) as sinon.SinonStub,
		findForeignObject: stub(),
		delForeignObject: ((id: string, callback?: ioBroker.ErrorCallback) => {
			db.deleteObject(id);
			if (typeof callback === "function") callback(undefined);
		}) as sinon.SinonStub,

		setState: ((...args: any[] /* id: string, state: any, ack?: boolean */) => {
			let [id, state, ack] = args as any as [string, any, boolean?];
			const lastArg = args[args.length - 1];
			const callback: ioBroker.SetStateCallback | undefined = typeof lastArg === "function" ? lastArg : undefined;
			if (typeof ack !== "boolean") ack = false;

			if (!id.startsWith(ret.namespace)) id = ret.namespace + "." + id;

			if (state != null && typeof state === "object") {
				ack = !!state.ack;
				state = state.val;
			}

			db.publishState(id, { val: state, ack });
			if (typeof callback === "function") callback(null, id);
		}) as sinon.SinonStub,
		setStateChanged: ((...args: any[] /* id: string, state: any, ack?: boolean */) => {
			let [id, state, ack] = args as any as [string, any, boolean?];
			const lastArg = args[args.length - 1];
			const callback: ioBroker.SetStateCallback | undefined = typeof lastArg === "function" ? lastArg : undefined;
			if (typeof ack !== "boolean") ack = false;

			if (state != null && typeof state === "object") {
				ack = !!state.ack;
				state = state.val;
			}

			if (!id.startsWith(ret.namespace)) id = ret.namespace + "." + id;
			if (!db.hasState(id) || db.getState(id)!.val !== state) {
				db.publishState(id, { val: state, ack });
			}
			if (typeof callback === "function") callback(null, id);
		}) as sinon.SinonStub,
		setForeignState: ((...args: any[] /* id: string, state: any, ack?: boolean */) => {
			// tslint:disable-next-line:prefer-const
			let [id, state, ack] = args as any as [string, any, boolean?];
			const lastArg = args[args.length - 1];
			const callback: ioBroker.SetStateCallback | undefined = typeof lastArg === "function" ? lastArg : undefined;
			if (typeof ack !== "boolean") ack = false;

			if (state != null && typeof state === "object") {
				ack = !!state.ack;
				state = state.val;
			}

			db.publishState(id, { val: state, ack });
			if (typeof callback === "function") callback(null, id);
		}) as sinon.SinonStub,
		setForeignStateChanged: ((...args: any[] /* id: string, state: any, ack?: boolean */) => {
			// tslint:disable-next-line:prefer-const
			let [id, state, ack] = args as any as [string, any, boolean?];
			const lastArg = args[args.length - 1];
			const callback: ioBroker.SetStateCallback | undefined = typeof lastArg === "function" ? lastArg : undefined;
			if (typeof ack !== "boolean") ack = false;

			if (state != null && typeof state === "object") {
				ack = !!state.ack;
				state = state.val;
			}

			if (!db.hasState(id) || db.getState(id)!.val !== state) {
				db.publishState(id, { val: state, ack });
			}
			if (typeof callback === "function") callback(null, id);
		}) as sinon.SinonStub,

		getState: ((id: string, callback: ioBroker.GetStateCallback) => {
			if (!id.startsWith(ret.namespace)) id = ret.namespace + "." + id;
			callback(null, db.getState(id));
		}) as sinon.SinonStub,
		getForeignState: ((id: string, callback: ioBroker.GetStateCallback) => {
			callback(null, db.getState(id));
		}) as sinon.SinonStub,
		getStates: ((pattern: string, callback: ioBroker.GetStatesCallback) => {
			if (!pattern.startsWith(ret.namespace)) pattern = ret.namespace + "." + pattern;
			callback(null, db.getStates(pattern));
		}) as sinon.SinonStub,
		getForeignStates: ((pattern: string, callback: ioBroker.GetStatesCallback) => {
			callback(null, db.getStates(pattern));
		}) as sinon.SinonStub,

		delState: ((id: string, callback?: ioBroker.ErrorCallback) => {
			if (!id.startsWith(ret.namespace)) id = ret.namespace + "." + id;
			db.deleteState(id);
			if (typeof callback === "function") callback(undefined);
		}) as sinon.SinonStub,
		delForeignState: ((id: string, callback?: ioBroker.ErrorCallback) => {
			db.deleteState(id);
			if (typeof callback === "function") callback(undefined);
		}) as sinon.SinonStub,

		getHistory: stub(),

		setBinaryState: stub(),
		getBinaryState: stub(),

		getEnum: stub(),
		getEnums: stub(),

		addChannelToEnum: stub(),
		deleteChannelFromEnum: stub(),

		addStateToEnum: stub(),
		deleteStateFromEnum: stub(),

		subscribeObjects: stub(),
		subscribeForeignObjects: stub(),
		unsubscribeObjects: stub(),
		unsubscribeForeignObjects: stub(),

		subscribeStates: stub(),
		subscribeForeignStates: stub(),
		unsubscribeStates: stub(),
		unsubscribeForeignStates: stub(),

		createDevice: stub(),
		deleteDevice: stub(),
		createChannel: stub(),
		deleteChannel: stub(),

		createState: stub(),
		deleteState: stub(),

		getDevices: stub(),
		getChannels: stub(),
		getChannelsOf: stub(),
		getStatesOf: stub(),

		readDir: stub(),
		mkDir: stub(),

		readFile: stub(),
		writeFile: stub(),

		delFile: stub(),
		unlink: stub(),

		rename: stub(),

		chmodFile: stub(),

		formatValue: stub(),
		formatDate: stub(),

		readyHandler: options.ready,
		messageHandler: options.message,
		objectChangeHandler: options.objectChange,
		stateChangeHandler: options.stateChange,
		unloadHandler: options.unload,

		terminate: stub().callsFake((reason?: string) => {
			// Terminates execution by
			const err = new Error(`Adapter.terminate was called${reason ? ` with reason: "${reason}"` : ""}!`);
			// @ts-ignore
			err.terminateReason = reason || "no reason given!";
			throw err;
		}),

		// EventEmitter methods
		on: stub().callsFake((event: string, handler: (...args: any[]) => void) => {
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
		}),
		// TODO: Do we need those?
		// removeListener: stub(),
		// removeAllListeners: stub(),

		// Mock-specific methods
		resetMockHistory() {
			// reset Adapter
			doResetHistory(ret);
			(ret.log as MockLogger).resetMockHistory();
			(ret.objects as MockObjects).resetMockHistory();
		},
		resetMockBehavior() {
			// reset Adapter
			doResetBehavior(ret, implementedMethods);
			(ret.log as MockLogger).resetMockBehavior();
			(ret.objects as MockObjects).resetMockBehavior();
		},
		resetMock() {
			ret.resetMockHistory();
			ret.resetMockBehavior();
		},
	} as MockAdapter;

	stubAndPromisifyImplementedMethods(ret, implementedMethods);

	return ret;
}
