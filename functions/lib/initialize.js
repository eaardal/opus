"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * MUST be imported as the very first thing in `index.ts`. Initialises the
 * firebase-admin default app at module load so every handler can safely call
 * `getFirestore()` (and friends) without worrying about init order.
 *
 * Don't import this file from anywhere except `index.ts` — its side effect is
 * the entire point.
 */
const app_1 = require("firebase-admin/app");
if ((0, app_1.getApps)().length === 0) {
    (0, app_1.initializeApp)();
}
//# sourceMappingURL=initialize.js.map