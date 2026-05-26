"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AtlassianTokenStore = void 0;
const firestore_1 = require("firebase-admin/firestore");
const COLLECTION_USERS = "users";
const SUBCOLLECTION_INTEGRATIONS = "integrations";
const DOC_ATLASSIAN = "atlassian";
/**
 * Small abstraction over the Firestore path that holds a user's Atlassian
 * tokens. Callables call this so the storage layout is changed in one place.
 */
class AtlassianTokenStore {
    firestore;
    constructor(firestore) {
        this.firestore = firestore;
    }
    async save(userEmail, integration) {
        await this.docRef(userEmail).set(integration);
    }
    async get(userEmail) {
        const snap = await this.docRef(userEmail).get();
        return snap.exists ? snap.data() : null;
    }
    async delete(userEmail) {
        await this.docRef(userEmail).delete();
    }
    /** Compute the expiry timestamp `expiresInSeconds` from now. */
    static expiryFromNow(expiresInSeconds) {
        return firestore_1.Timestamp.fromMillis(Date.now() + expiresInSeconds * 1000);
    }
    docRef(userEmail) {
        return this.firestore
            .collection(COLLECTION_USERS)
            .doc(userEmail)
            .collection(SUBCOLLECTION_INTEGRATIONS)
            .doc(DOC_ATLASSIAN);
    }
}
exports.AtlassianTokenStore = AtlassianTokenStore;
//# sourceMappingURL=tokenStore.js.map