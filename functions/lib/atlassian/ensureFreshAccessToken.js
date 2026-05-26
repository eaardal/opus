"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_REFRESH_LEEWAY_MS = void 0;
exports.ensureFreshAccessToken = ensureFreshAccessToken;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
/** Refresh slightly before actual expiry so callers don't race the cutoff. */
exports.DEFAULT_REFRESH_LEEWAY_MS = 5 * 60 * 1000;
/**
 * Returns a valid access token for `callerEmail`, refreshing the stored
 * integration doc when the current token is missing or within `leewayMs` of
 * expiry. Throws `HttpsError("failed-precondition")` when the user is not
 * connected to Atlassian.
 */
async function ensureFreshAccessToken(deps, callerEmail) {
    const leeway = deps.leewayMs ?? exports.DEFAULT_REFRESH_LEEWAY_MS;
    const existing = await deps.tokens.get(callerEmail);
    if (!existing) {
        throw new https_1.HttpsError("failed-precondition", "Atlassian is not connected.");
    }
    const now = deps.now();
    const expiresMs = existing.expiresAt.toMillis();
    if (expiresMs - now.getTime() > leeway) {
        return { accessToken: existing.accessToken, cloudId: existing.cloudId };
    }
    const refreshed = await deps.atlassian.refreshTokens(existing.refreshToken);
    const newExpiresAt = firestore_1.Timestamp.fromMillis(now.getTime() + refreshed.expires_in * 1000);
    const updated = {
        ...existing,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token ?? existing.refreshToken,
        scope: refreshed.scope,
        expiresAt: newExpiresAt,
        updatedAt: firestore_1.Timestamp.fromDate(now),
    };
    await deps.tokens.save(callerEmail, updated);
    return { accessToken: updated.accessToken, cloudId: updated.cloudId };
}
//# sourceMappingURL=ensureFreshAccessToken.js.map