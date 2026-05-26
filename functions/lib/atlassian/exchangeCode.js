"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.atlassianExchangeCode = void 0;
exports.makeExchangeCodeHandler = makeExchangeCodeHandler;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const adminApp_js_1 = require("./adminApp.js");
const atlassianClient_js_1 = require("./atlassianClient.js");
const secrets_js_1 = require("./secrets.js");
const tokenStore_js_1 = require("./tokenStore.js");
/**
 * Pure handler: takes already-resolved deps + the caller's authenticated
 * email and the OAuth callback inputs. Splits cleanly from `onCall` so the
 * unit test never touches Firebase Functions internals.
 */
function makeExchangeCodeHandler(deps) {
    return async (callerEmail, input) => {
        const tokens = await deps.atlassian.exchangeAuthorizationCode({
            code: input.code,
            redirectUri: input.redirectUri,
            codeVerifier: input.codeVerifier,
        });
        const account = await deps.atlassian.getAccount(tokens.access_token);
        const cloudId = await firstResourceId(deps.atlassian, tokens.access_token);
        const now = deps.now();
        const nowTs = firestore_1.Timestamp.fromDate(now);
        const expiresAt = firestore_1.Timestamp.fromMillis(now.getTime() + tokens.expires_in * 1000);
        const integration = {
            accountId: account.account_id,
            accountEmail: account.email,
            accountName: account.name,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            scope: tokens.scope,
            expiresAt,
            cloudId,
            connectedAt: nowTs,
            updatedAt: nowTs,
        };
        await deps.tokens.save(callerEmail, integration);
        return {
            accountId: account.account_id,
            accountEmail: account.email,
            accountName: account.name,
            scope: tokens.scope,
            cloudId,
        };
    };
}
async function firstResourceId(client, accessToken) {
    const resources = await client.getAccessibleResources(accessToken);
    return resources[0]?.id ?? null;
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
function validateInput(raw) {
    if (!raw || typeof raw !== "object") {
        throw new https_1.HttpsError("invalid-argument", "Missing payload.");
    }
    const r = raw;
    if (!r.code || !r.redirectUri || !r.codeVerifier) {
        throw new https_1.HttpsError("invalid-argument", "code, redirectUri and codeVerifier are required.");
    }
    return { code: r.code, redirectUri: r.redirectUri, codeVerifier: r.codeVerifier };
}
exports.atlassianExchangeCode = (0, https_1.onCall)({ secrets: [secrets_js_1.ATLASSIAN_CLIENT_ID, secrets_js_1.ATLASSIAN_CLIENT_SECRET] }, async (request) => {
    const callerEmail = requireCallerEmail(request);
    const input = validateInput(request.data);
    const handler = makeExchangeCodeHandler({
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
        throw new https_1.HttpsError("internal", "Failed to complete Atlassian sign-in.", {
            cause: err instanceof Error ? err.message : String(err),
        });
    }
});
//# sourceMappingURL=exchangeCode.js.map