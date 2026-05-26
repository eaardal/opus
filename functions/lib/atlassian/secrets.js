"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ATLASSIAN_CLIENT_SECRET = exports.ATLASSIAN_CLIENT_ID = void 0;
const params_1 = require("firebase-functions/params");
/**
 * Atlassian OAuth credentials, held in Firebase Secret Manager.
 *
 * Provision via:
 *   firebase functions:secrets:set ATLASSIAN_CLIENT_ID
 *   firebase functions:secrets:set ATLASSIAN_CLIENT_SECRET
 *
 * Both must be bound to a function (`{ secrets: [ATLASSIAN_CLIENT_ID, ...] }`)
 * for that function to read them at runtime.
 */
exports.ATLASSIAN_CLIENT_ID = (0, params_1.defineSecret)("ATLASSIAN_CLIENT_ID");
exports.ATLASSIAN_CLIENT_SECRET = (0, params_1.defineSecret)("ATLASSIAN_CLIENT_SECRET");
//# sourceMappingURL=secrets.js.map