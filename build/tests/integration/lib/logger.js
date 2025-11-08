"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = createLogger;
var LoglevelOrder;
(function (LoglevelOrder) {
    LoglevelOrder[LoglevelOrder["error"] = 0] = "error";
    LoglevelOrder[LoglevelOrder["warn"] = 1] = "warn";
    LoglevelOrder[LoglevelOrder["info"] = 2] = "info";
    LoglevelOrder[LoglevelOrder["debug"] = 3] = "debug";
    LoglevelOrder[LoglevelOrder["silly"] = 4] = "silly";
})(LoglevelOrder || (LoglevelOrder = {}));
function createLogger(loglevel) {
    const loglevelNumeric = LoglevelOrder[loglevel ?? 'debug'] ?? LoglevelOrder.debug;
    const ignore = () => { };
    return {
        error: loglevelNumeric >= LoglevelOrder.error ? console.error : ignore,
        warn: loglevelNumeric >= LoglevelOrder.warn ? console.warn : ignore,
        info: loglevelNumeric >= LoglevelOrder.info ? console.log : ignore,
        debug: loglevelNumeric >= LoglevelOrder.debug ? console.log : ignore,
        silly: loglevelNumeric >= LoglevelOrder.silly ? console.log : ignore,
        level: loglevel,
    };
}
