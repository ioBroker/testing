"use strict";
// wotan-disable async-function-assignability
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const adapterTools_1 = require("../../lib/adapterTools");
const startMockAdapter_1 = require("../../lib/startMockAdapter");
/**
 * Tests the adapter startup in offline mode (with mocks, no JS-Controller)
 * This is meant to be executed in a mocha context.
 */
function testAdapterStartupOffline(adapterDir) {
    const mainFilename = adapterTools_1.locateAdapterMainFile(adapterDir);
    const supportsCompactMode = adapterTools_1.adapterShouldSupportCompactMode(adapterDir);
    describe(`Test the adapter startup (in a mocked environment) => `, () => {
        it("The adapter starts in normal mode", () => __awaiter(this, void 0, void 0, function* () {
            const { adapterMock, databaseMock } = yield startMockAdapter_1.startMockAdapter(mainFilename);
            // TODO: Test that the unload callback is called
        }));
        if (supportsCompactMode) {
            it("The adapter starts in compact mode", () => __awaiter(this, void 0, void 0, function* () {
                const { adapterMock, databaseMock } = yield startMockAdapter_1.startMockAdapter(mainFilename, true);
                // TODO: Test that the unload callback is called
            }));
        }
    });
}
exports.testAdapterStartupOffline = testAdapterStartupOffline;
