"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ping = void 0;
const https_1 = require("firebase-functions/v2/https");
/**
 * Authenticated smoke-test callable. Returns the caller's email so we can
 * verify the deploy + auth context end-to-end before wiring real features.
 */
exports.ping = (0, https_1.onCall)((request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Sign in required.");
    }
    return {
        ok: true,
        callerEmail: request.auth.token.email ?? null,
        timestamp: new Date().toISOString(),
    };
});
//# sourceMappingURL=ping.js.map