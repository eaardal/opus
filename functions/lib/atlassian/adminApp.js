"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminFirestore = getAdminFirestore;
const firestore_1 = require("firebase-admin/firestore");
/**
 * The firebase-admin default app is initialised in `../initialize.ts`, which
 * is imported as the very first line of `index.ts`. That guarantees the
 * default app exists by the time any callable handler runs, so the default
 * lookup inside `getFirestore()` is safe.
 */
function getAdminFirestore() {
    return (0, firestore_1.getFirestore)();
}
//# sourceMappingURL=adminApp.js.map