"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.atlassianDisconnect = void 0;
exports.makeDisconnectHandler = makeDisconnectHandler;
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const adminApp_js_1 = require("./adminApp.js");
const atlassianClient_js_1 = require("./atlassianClient.js");
const secrets_js_1 = require("./secrets.js");
const tokenStore_js_1 = require("./tokenStore.js");
/**
 * Best-effort revoke at Atlassian + delete the Firestore doc. If revoke
 * fails (e.g. token already invalid) we still delete locally so the user
 * isn't stuck in a half-connected state.
 */
function makeDisconnectHandler(deps) {
    return async (callerEmail) => {
        const existing = await deps.tokens.get(callerEmail);
        if (!existing) {
            return { removed: false };
        }
        try {
            await deps.atlassian.revokeToken(existing.refreshToken);
        }
        catch (err) {
            if (err instanceof atlassianClient_js_1.AtlassianApiError) {
                v2_1.logger.warn("Atlassian revoke returned non-2xx; deleting local token anyway.", {
                    status: err.status,
                    callerEmail,
                });
            }
            else {
                v2_1.logger.warn("Atlassian revoke failed; deleting local token anyway.", {
                    callerEmail,
                    message: err instanceof Error ? err.message : String(err),
                });
            }
        }
        await deps.tokens.delete(callerEmail);
        return { removed: true };
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
exports.atlassianDisconnect = (0, https_1.onCall)({ secrets: [secrets_js_1.ATLASSIAN_CLIENT_ID, secrets_js_1.ATLASSIAN_CLIENT_SECRET] }, async (request) => {
    const callerEmail = requireCallerEmail(request);
    const handler = makeDisconnectHandler({
        atlassian: new atlassianClient_js_1.AtlassianClient({
            clientId: secrets_js_1.ATLASSIAN_CLIENT_ID.value(),
            clientSecret: secrets_js_1.ATLASSIAN_CLIENT_SECRET.value(),
        }),
        tokens: new tokenStore_js_1.AtlassianTokenStore((0, adminApp_js_1.getAdminFirestore)()),
    });
    try {
        return await handler(callerEmail);
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        throw new https_1.HttpsError("internal", "Failed to disconnect Atlassian.", {
            cause: err instanceof Error ? err.message : String(err),
        });
    }
});
//# sourceMappingURL=disconnect.js.map