"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sinon_1 = require("sinon");
const objects_1 = require("alcalzone-shared/objects");
const mockLogger_1 = require("./mockLogger");
const mockObjects_1 = require("./mockObjects");
const tools_1 = require("./tools");
// Define here which methods were implemented manually, so we can hook them up with a real stub
// The value describes if and how the async version of the callback is constructed
const implementedMethods = {
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
    on: "none",
    terminate: "none",
};
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
        log: mockLogger_1.createLoggerMock(),
        version: "any",
        states: {},
        objects: mockObjects_1.createObjectsMock(db),
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
        terminate: ((reason) => {
            // Terminates execution by
            const err = new Error(`Adapter.terminate was called${reason ? ` with reason: "${reason}"` : ""}!`);
            // @ts-ignore
            err.terminateReason = reason || "no reason given!";
            throw err;
        }),
        // EventEmitter methods
        on: ((event, handler) => {
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
        }),
        removeListener: ((event, listener) => {
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
        }),
        removeAllListeners: ((event) => {
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
        }),
        // Access the options object directly, so we can react to later changes
        get readyHandler() {
            return options.ready;
        },
        set readyHandler(handler) {
            options.ready = handler;
        },
        get messageHandler() {
            return options.message;
        },
        set messageHandler(handler) {
            options.message = handler;
        },
        get objectChangeHandler() {
            return options.objectChange;
        },
        set objectChangeHandler(handler) {
            options.objectChange = handler;
        },
        get stateChangeHandler() {
            return options.stateChange;
        },
        set stateChangeHandler(handler) {
            options.stateChange = handler;
        },
        get unloadHandler() {
            return options.unload;
        },
        set unloadHandler(handler) {
            options.unload = handler;
        },
        // Mock-specific methods
        resetMockHistory() {
            // reset Adapter
            tools_1.doResetHistory(ret);
            ret.log.resetMockHistory();
            ret.objects.resetMockHistory();
        },
        resetMockBehavior() {
            // reset Adapter
            tools_1.doResetBehavior(ret, implementedMethods);
            ret.log.resetMockBehavior();
            ret.objects.resetMockBehavior();
        },
        resetMock() {
            ret.resetMockHistory();
            ret.resetMockBehavior();
        },
    };
    tools_1.stubAndPromisifyImplementedMethods(ret, implementedMethods);
    return ret;
}
exports.createAdapterMock = createAdapterMock;
