"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.str2regex = str2regex;
function str2regex(pattern) {
    return new RegExp(pattern
        .replace(/\\/g, '\\\\') // Backslashes escapen
        .replace(/\./g, '\\.') // Punkte als solche matchen
        .replace(/\*/g, '.*') // Wildcard in Regex umsetzen
        .replace(/!/g, '?!'));
}
