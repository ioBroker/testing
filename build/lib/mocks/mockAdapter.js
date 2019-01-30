"use strict";
// tslint:disable-next-line:no-reference
Object.defineProperty(exports, "__esModule", { value: true });
const sinon_1 = require("sinon");
const async_1 = require("alcalzone-shared/async");
const objects_1 = require("alcalzone-shared/objects");
// Define here, which methods are implemented manually, so we can hook them up with a real stub
const implementedMethodsDefaultCallback = [
    "getObject",
    "setObject",
    "setObjectNotExists",
    "extendObject",
    "getForeignObject",
    "getForeignObjects",
    "setForeignObject",
    "setForeignObjectNotExists",
    "extendForeignObject",
    "getState",
    "getStates",
    "setState",
    "setStateChanged",
    "delState",
    "getForeignState",
    "setForeignState",
    "setForeignStateChanged",
];
const implementedMethodsNoErrorCallback = [
    "getAdapterObjects",
];
const implementedMethods = []
    .concat(...implementedMethodsDefaultCallback)
    .concat(...implementedMethodsNoErrorCallback);
/**
 * Creates an adapter mock that is connected to a given database mock
 */
function createAdapterMock(db, options = {}) {
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
        log: {
            info: sinon_1.stub(),
            warn: sinon_1.stub(),
            error: sinon_1.stub(),
            debug: sinon_1.stub(),
            silly: sinon_1.stub(),
            level: "info",
        },
        version: "any",
        states: {},
        objects: {},
        connected: true,
        getPort: sinon_1.stub(),
        stop: sinon_1.stub(),
        checkPassword: sinon_1.stub(),
        setPassword: sinon_1.stub(),
        checkGroup: sinon_1.stub(),
        calculatePermissions: sinon_1.stub(),
        getCertificates: sinon_1.stub(),
        sendTo: sinon_1.stub(),
        sendToHost: sinon_1.stub(),
        idToDCS: sinon_1.stub(),
        getObject: ((id, callback) => {
            if (!id.startsWith(ret.namespace))
                id = ret.namespace + "." + id;
            callback(null, db.getObject(id));
        }),
        setObject: ((id, obj, callback) => {
            if (!id.startsWith(ret.namespace))
                id = ret.namespace + "." + id;
            obj._id = id;
            db.publishObject(obj);
            if (typeof callback === "function")
                callback(null, { id });
        }),
        setObjectNotExists: ((id, obj, callback) => {
            if (!id.startsWith(ret.namespace))
                id = ret.namespace + "." + id;
            if (db.hasObject(id)) {
                if (typeof callback === "function")
                    callback(null, { id });
            }
            else {
                ret.setObject(id, obj, callback);
            }
        }),
        getAdapterObjects: ((callback) => {
            callback(db.getObjects(`${ret.namespace}.*`));
        }),
        extendObject: ((id, obj, callback) => {
            if (!id.startsWith(ret.namespace))
                id = ret.namespace + "." + id;
            const existing = db.getObject(id) || {};
            const target = objects_1.extend({}, existing, obj);
            db.publishObject(target);
            if (typeof callback === "function")
                callback(null, { id: target._id, value: target }, id);
        }),
        delObject: ((id, callback) => {
            if (!id.startsWith(ret.namespace))
                id = ret.namespace + "." + id;
            db.deleteObject(id);
            if (typeof callback === "function")
                callback(undefined);
        }),
        getForeignObject: ((id, callback) => {
            callback(null, db.getObject(id));
        }),
        getForeignObjects: ((...args /*pattern: string, type: ioBroker.ObjectType */) => {
            const [pattern, type] = args;
            const lastArg = args[args.length - 1];
            const callback = typeof lastArg === "function" ? lastArg : undefined;
            if (typeof callback === "function")
                callback(null, db.getObjects(pattern, type));
        }),
        setForeignObject: ((id, obj, callback) => {
            obj._id = id;
            db.publishObject(obj);
            if (typeof callback === "function")
                callback(null, { id });
        }),
        setForeignObjectNotExists: ((id, obj, callback) => {
            if (db.hasObject(id)) {
                if (typeof callback === "function")
                    callback(null, { id });
            }
            else {
                ret.setObject(id, obj, callback);
            }
        }),
        extendForeignObject: ((id, obj, callback) => {
            const target = db.getObject(id) || {};
            Object.assign(target, obj);
            db.publishObject(target);
            if (typeof callback === "function")
                callback(null, { id: target._id, value: target }, id);
        }),
        findForeignObject: sinon_1.stub(),
        delForeignObject: ((id, callback) => {
            db.deleteObject(id);
            if (typeof callback === "function")
                callback(undefined);
        }),
        setState: ((...args /* id: string, state: any, ack?: boolean */) => {
            let [id, state, ack] = args;
            const lastArg = args[args.length - 1];
            const callback = typeof lastArg === "function" ? lastArg : undefined;
            if (typeof ack !== "boolean")
                ack = false;
            if (!id.startsWith(ret.namespace))
                id = ret.namespace + "." + id;
            if (state != null && typeof state === "object") {
                ack = !!state.ack;
                state = state.val;
            }
            db.publishState(id, { val: state, ack });
            if (typeof callback === "function")
                callback(null, id);
        }),
        setStateChanged: ((...args /* id: string, state: any, ack?: boolean */) => {
            let [id, state, ack] = args;
            const lastArg = args[args.length - 1];
            const callback = typeof lastArg === "function" ? lastArg : undefined;
            if (typeof ack !== "boolean")
                ack = false;
            if (state != null && typeof state === "object") {
                ack = !!state.ack;
                state = state.val;
            }
            if (!id.startsWith(ret.namespace))
                id = ret.namespace + "." + id;
            if (!db.hasState(id) || db.getState(id).val !== state) {
                db.publishState(id, { val: state, ack });
            }
            if (typeof callback === "function")
                callback(null, id);
        }),
        setForeignState: ((...args /* id: string, state: any, ack?: boolean */) => {
            // tslint:disable-next-line:prefer-const
            let [id, state, ack] = args;
            const lastArg = args[args.length - 1];
            const callback = typeof lastArg === "function" ? lastArg : undefined;
            if (typeof ack !== "boolean")
                ack = false;
            if (state != null && typeof state === "object") {
                ack = !!state.ack;
                state = state.val;
            }
            db.publishState(id, { val: state, ack });
            if (typeof callback === "function")
                callback(null, id);
        }),
        setForeignStateChanged: ((...args /* id: string, state: any, ack?: boolean */) => {
            // tslint:disable-next-line:prefer-const
            let [id, state, ack] = args;
            const lastArg = args[args.length - 1];
            const callback = typeof lastArg === "function" ? lastArg : undefined;
            if (typeof ack !== "boolean")
                ack = false;
            if (state != null && typeof state === "object") {
                ack = !!state.ack;
                state = state.val;
            }
            if (!db.hasState(id) || db.getState(id).val !== state) {
                db.publishState(id, { val: state, ack });
            }
            if (typeof callback === "function")
                callback(null, id);
        }),
        getState: ((id, callback) => {
            if (!id.startsWith(ret.namespace))
                id = ret.namespace + "." + id;
            callback(null, db.getState(id));
        }),
        getForeignState: ((id, callback) => {
            callback(null, db.getState(id));
        }),
        getStates: ((pattern, callback) => {
            if (!pattern.startsWith(ret.namespace))
                pattern = ret.namespace + "." + pattern;
            callback(null, db.getStates(pattern));
        }),
        getForeignStates: ((pattern, callback) => {
            callback(null, db.getStates(pattern));
        }),
        delState: ((id, callback) => {
            if (!id.startsWith(ret.namespace))
                id = ret.namespace + "." + id;
            db.deleteState(id);
            if (typeof callback === "function")
                callback(undefined);
        }),
        delForeignState: ((id, callback) => {
            db.deleteState(id);
            if (typeof callback === "function")
                callback(undefined);
        }),
        getHistory: sinon_1.stub(),
        setBinaryState: sinon_1.stub(),
        getBinaryState: sinon_1.stub(),
        getEnum: sinon_1.stub(),
        getEnums: sinon_1.stub(),
        addChannelToEnum: sinon_1.stub(),
        deleteChannelFromEnum: sinon_1.stub(),
        addStateToEnum: sinon_1.stub(),
        deleteStateFromEnum: sinon_1.stub(),
        subscribeObjects: sinon_1.stub(),
        subscribeForeignObjects: sinon_1.stub(),
        unsubscribeObjects: sinon_1.stub(),
        unsubscribeForeignObjects: sinon_1.stub(),
        subscribeStates: sinon_1.stub(),
        subscribeForeignStates: sinon_1.stub(),
        unsubscribeStates: sinon_1.stub(),
        unsubscribeForeignStates: sinon_1.stub(),
        createDevice: sinon_1.stub(),
        deleteDevice: sinon_1.stub(),
        createChannel: sinon_1.stub(),
        deleteChannel: sinon_1.stub(),
        createState: sinon_1.stub(),
        deleteState: sinon_1.stub(),
        getDevices: sinon_1.stub(),
        getChannels: sinon_1.stub(),
        getChannelsOf: sinon_1.stub(),
        getStatesOf: sinon_1.stub(),
        readDir: sinon_1.stub(),
        mkDir: sinon_1.stub(),
        readFile: sinon_1.stub(),
        writeFile: sinon_1.stub(),
        delFile: sinon_1.stub(),
        unlink: sinon_1.stub(),
        rename: sinon_1.stub(),
        chmodFile: sinon_1.stub(),
        formatValue: sinon_1.stub(),
        formatDate: sinon_1.stub(),
        readyHandler: options.ready,
        messageHandler: options.message,
        objectChangeHandler: options.objectChange,
        stateChangeHandler: options.stateChange,
        unloadHandler: options.unload,
        // EventEmitter methods
        on: sinon_1.stub().callsFake((event, handler) => {
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
            // reset Adapter.Log
            doResetHistory(ret.log);
        },
        resetMockBehavior() {
            // reset Adapter
            doResetBehavior(ret);
            // reset Adapter.Log
            doResetBehavior(ret.log);
        },
        resetMock() {
            ret.resetMockHistory();
            ret.resetMockBehavior();
        },
    };
    // promisify methods
    const dontOverwriteThis = () => { throw new Error("You must not overwrite the behavior of this stub!"); };
    // The methods implemented above are no stubs, but we claimed they are
    // Therefore hook them up with a real stub
    for (const method of implementedMethodsDefaultCallback) {
        if (method.endsWith("Async"))
            continue;
        const originalMethod = ret[method];
        const callbackFake = ret[method] = sinon_1.stub();
        callbackFake.callsFake(originalMethod);
        const asyncFake = sinon_1.stub().callsFake(async_1.promisify(originalMethod, ret));
        ret[`${method}Async`] = asyncFake;
        // Prevent the user from changing the stub's behavior
        callbackFake.returns = dontOverwriteThis;
        callbackFake.callsFake = dontOverwriteThis;
        asyncFake.returns = dontOverwriteThis;
        asyncFake.callsFake = dontOverwriteThis;
    }
    for (const method of implementedMethodsNoErrorCallback) {
        if (method.endsWith("Async"))
            continue;
        const originalMethod = ret[method];
        const callbackFake = ret[method] = sinon_1.stub();
        callbackFake.callsFake(originalMethod);
        const asyncFake = sinon_1.stub().callsFake(async_1.promisifyNoError(originalMethod, ret));
        ret[`${method}Async`] = asyncFake;
        // Prevent the user from changing the stub's behavior
        callbackFake.returns = dontOverwriteThis;
        callbackFake.callsFake = dontOverwriteThis;
        asyncFake.returns = dontOverwriteThis;
        asyncFake.callsFake = dontOverwriteThis;
    }
    return ret;
}
exports.createAdapterMock = createAdapterMock;
function doResetHistory(parent) {
    for (const prop of Object.keys(parent)) {
        const val = parent[prop];
        if (val && typeof val.resetHistory === "function")
            val.resetHistory();
    }
}
function doResetBehavior(parent) {
    for (const prop of Object.keys(parent)) {
        if (implementedMethods.indexOf(prop) > -1 || (prop.endsWith("Async") && implementedMethods.indexOf(prop.slice(0, -5))) > -1)
            continue;
        const val = parent[prop];
        if (val && typeof val.resetBehavior === "function")
            val.resetBehavior();
    }
}
