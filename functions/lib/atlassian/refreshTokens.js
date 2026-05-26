"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.atlassianRefreshTokens = void 0;
exports.makeRefreshTokensHandler = makeRefreshTokensHandler;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const adminApp_js_1 = require("./adminApp.js");
const atlassianClient_js_1 = require("./atlassianClient.js");
const ensureFreshAccessToken_js_1 = require("./ensureFreshAccessToken.js");
const secrets_js_1 = require("./secrets.js");
const tokenStore_js_1 = require("./tokenStore.js");
/** Refresh slightly before actual expiry so callers don't race the cutoff. */
const REFRESH_LEEWAY_MS = ensureFreshAccessToken_js_1.DEFAULT_REFRESH_LEEWAY_MS;
/**
 * Refresh the access token if it's expired or within `leewayMs` of expiry.
 * Honours Atlassian's refresh-token rotation — the new refresh token
 * (if returned) replaces the old one in storage.
 */
function makeRefreshTokensHandler(deps) {
    const leeway = deps.leewayMs ?? REFRESH_LEEWAY_MS;
    return async (callerEmail, input) => {
        const existing = await deps.tokens.get(callerEmail);
        if (!existing) {
            throw new https_1.HttpsError("failed-precondition", "Atlassian is not connected.");
        }
        const now = deps.now();
        const expiresMs = existing.expiresAt.toMillis();
        if (!input.force && expiresMs - now.getTime() > leeway) {
            return { refreshed: false, expiresAt: new Date(expiresMs).toISOString() };
        }
        const refreshed = await deps.atlassian.refreshTokens(existing.refreshToken);
        const newExpiresAt = firestore_1.Timestamp.fromMillis(now.getTime() + refreshed.expires_in * 1000);
        const updated = {
            ...existing,
            accessToken: refreshed.access_token,
            // Atlassian may rotate the refresh token; always trust the response.
            refreshToken: refreshed.refresh_token ?? existing.refreshToken,
            scope: refreshed.scope,
            expiresAt: newExpiresAt,
            updatedAt: firestore_1.Timestamp.fromDate(now),
        };
        await deps.tokens.save(callerEmail, updated);
        return { refreshed: true, expiresAt: newExpiresAt.toDate().toISOString() };
    };
}
function requireCallerEmail(request) {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Sign in required.");
    }
    const email = request.auth.token.email;
    if (!email) {
        throw new https_1.HttpsError("failed-precondition", "Authenticated user has no email.");
    }
    return email;
}
function parseInput(raw) {
    if (!raw || typeof raw !== "object")
        return {};
    const r = raw;
    return { force: r.force === true };
}
exports.atlassianRefreshTokens = (0, https_1.onCall)({ secrets: [secrets_js_1.ATLASSIAN_CLIENT_ID, secrets_js_1.ATLASSIAN_CLIENT_SECRET] }, async (request) => {
    const callerEmail = requireCallerEmail(request);
    const input = parseInput(request.data);
    const handler = makeRefreshTokensHandler({
        atlassian: new atlassianClient_js_1.AtlassianClient({
            clientId: secrets_js_1.ATLASSIAN_CLIENT_ID.value(),
            clientSecret: secrets_js_1.ATLASSIAN_CLIENT_SECRET.value(),
        }),
        tokens: new tokenStore_js_1.AtlassianTokenStore((0, adminApp_js_1.getAdminFirestore)()),
        now: () => new Date(),
    });
    try {
        return await handler(callerEmail, input);
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        throw new https_1.HttpsError("internal", "Failed to refresh Atlassian tokens.", {
            cause: err instanceof Error ? err.message : String(err),
        });
    }
});
//# sourceMappingURL=refreshTokens.js.map