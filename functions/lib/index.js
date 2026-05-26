"use strict";
/**
 * Cloud Functions entry point. Each feature lives in its own module and is
 * re-exported here so `firebase deploy --only functions:<name>` works.
 *
 * `./initialize.js` MUST be imported first — it side-effects the
 * firebase-admin default app into existence before any handler runs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.atlassianSearchIssues = exports.atlassianRefreshTokens = exports.atlassianDisconnect = exports.atlassianExchangeCode = exports.ping = void 0;
require("./initialize.js");
const v2_1 = require("firebase-functions/v2");
// Default region for every function in this codebase. Override per-function
// by passing { region } when defining the function.
(0, v2_1.setGlobalOptions)({ region: "europe-west1", maxInstances: 10 });
var ping_js_1 = require("./ping.js");
Object.defineProperty(exports, "ping", { enumerable: true, get: function () { return ping_js_1.ping; } });
var exchangeCode_js_1 = require("./atlassian/exchangeCode.js");
Object.defineProperty(exports, "atlassianExchangeCode", { enumerable: true, get: function () { return exchangeCode_js_1.atlassianExchangeCode; } });
var disconnect_js_1 = require("./atlassian/disconnect.js");
Object.defineProperty(exports, "atlassianDisconnect", { enumerable: true, get: function () { return disconnect_js_1.atlassianDisconnect; } });
var refreshTokens_js_1 = require("./atlassian/refreshTokens.js");
Object.defineProperty(exports, "atlassianRefreshTokens", { enumerable: true, get: function () { return refreshTokens_js_1.atlassianRefreshTokens; } });
var searchIssues_js_1 = require("./atlassian/searchIssues.js");
Object.defineProperty(exports, "atlassianSearchIssues", { enumerable: true, get: function () { return searchIssues_js_1.atlassianSearchIssues; } });
//# sourceMappingURL=index.js.map