"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.atlassianSearchIssues = void 0;
exports.makeSearchIssuesHandler = makeSearchIssuesHandler;
const https_1 = require("firebase-functions/v2/https");
const adminApp_js_1 = require("./adminApp.js");
const atlassianClient_js_1 = require("./atlassianClient.js");
const ensureFreshAccessToken_js_1 = require("./ensureFreshAccessToken.js");
const secrets_js_1 = require("./secrets.js");
const tokenStore_js_1 = require("./tokenStore.js");
function makeSearchIssuesHandler(deps) {
    return async (callerEmail, input) => {
        const { accessToken, cloudId } = await (0, ensureFreshAccessToken_js_1.ensureFreshAccessToken)(deps, callerEmail);
        if (!cloudId) {
            throw new https_1.HttpsError("failed-precondition", "Connected Atlassian account has no Jira site (no cloudId).");
        }
        const issues = await deps.atlassian.searchJiraIssues(accessToken, cloudId, input.query);
        const siteUrl = await resolveSiteUrl(deps.atlassian, accessToken, cloudId);
        return {
            issues: issues.map((issue) => ({
                externalId: issue.key,
                title: issue.fields.summary,
                status: issue.fields.status.name,
                url: `${siteUrl}/browse/${issue.key}`,
            })),
        };
    };
}
/**
 * Resolve the user-facing site URL for the connected cloudId so the picker can
 * link straight back to the issue. Looked up via accessible-resources; if the
 * site is no longer accessible we fall back to a stub that still round-trips
 * through Atlassian's redirector.
 */
async function resolveSiteUrl(client, accessToken, cloudId) {
    try {
        const resources = await client.getAccessibleResources(accessToken);
        const match = resources.find((r) => r.id === cloudId);
        if (match?.url)
            return match.url;
    }
    catch {
        // Fall through to the fallback URL.
    }
    return `https://api.atlassian.com/ex/jira/${cloudId}`;
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
        return { query: "" };
    const r = raw;
    return { query: typeof r.query === "string" ? r.query : "" };
}
exports.atlassianSearchIssues = (0, https_1.onCall)({ secrets: [secrets_js_1.ATLASSIAN_CLIENT_ID, secrets_js_1.ATLASSIAN_CLIENT_SECRET] }, async (request) => {
    const callerEmail = requireCallerEmail(request);
    const input = parseInput(request.data);
    const handler = makeSearchIssuesHandler({
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
        throw new https_1.HttpsError("internal", "Failed to search Jira issues.", {
            cause: err instanceof Error ? err.message : String(err),
        });
    }
});
//# sourceMappingURL=searchIssues.js.map