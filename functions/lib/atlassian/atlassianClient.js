"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AtlassianApiError = exports.AtlassianClient = exports.ATLASSIAN_ACCESSIBLE_RESOURCES_URL = exports.ATLASSIAN_ME_URL = exports.ATLASSIAN_REVOKE_URL = exports.ATLASSIAN_TOKEN_URL = void 0;
/** Endpoint constants. Pulled out so tests can stub them if needed. */
exports.ATLASSIAN_TOKEN_URL = "https://auth.atlassian.com/oauth/token";
exports.ATLASSIAN_REVOKE_URL = "https://auth.atlassian.com/oauth/token/revoke";
exports.ATLASSIAN_ME_URL = "https://api.atlassian.com/me";
exports.ATLASSIAN_ACCESSIBLE_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources";
/** Per-call ceiling — picker shows a digestible list, not a paginated table. */
const JIRA_SEARCH_MAX_RESULTS = 50;
/**
 * Thin wrapper around Atlassian OAuth + identity endpoints. Holds no state
 * beyond the constructor deps so tests can substitute a fetch double.
 */
class AtlassianClient {
    clientId;
    clientSecret;
    fetchImpl;
    constructor(deps) {
        this.clientId = deps.clientId;
        this.clientSecret = deps.clientSecret;
        this.fetchImpl = deps.fetchImpl ?? fetch;
    }
    /** Exchange an authorization code for tokens (PKCE flow). */
    async exchangeAuthorizationCode(params) {
        return this.postJson(exports.ATLASSIAN_TOKEN_URL, {
            grant_type: "authorization_code",
            client_id: this.clientId,
            client_secret: this.clientSecret,
            code: params.code,
            redirect_uri: params.redirectUri,
            code_verifier: params.codeVerifier,
        });
    }
    /** Exchange a refresh token for a new access (and possibly refresh) token. */
    async refreshTokens(refreshToken) {
        return this.postJson(exports.ATLASSIAN_TOKEN_URL, {
            grant_type: "refresh_token",
            client_id: this.clientId,
            client_secret: this.clientSecret,
            refresh_token: refreshToken,
        });
    }
    /** Revoke a refresh token so it can no longer be used. Best-effort. */
    async revokeToken(refreshToken) {
        await this.postJson(exports.ATLASSIAN_REVOKE_URL, {
            token: refreshToken,
            client_id: this.clientId,
            client_secret: this.clientSecret,
        });
    }
    /** Fetch the connected Atlassian account profile. */
    async getAccount(accessToken) {
        return this.getJson(exports.ATLASSIAN_ME_URL, accessToken);
    }
    /** Resources (Jira sites etc.) the token is authorized to access. */
    async getAccessibleResources(accessToken) {
        return this.getJson(exports.ATLASSIAN_ACCESSIBLE_RESOURCES_URL, accessToken);
    }
    /**
     * Search Jira issues across the connected Cloud. `query` is treated as a
     * free-text fragment matched against summary and description via JQL.
     * Returns only the fields the Domino picker renders (summary + status).
     */
    async searchJiraIssues(accessToken, cloudId, query) {
        const jql = buildJql(query);
        const params = new URLSearchParams({
            jql,
            fields: "summary,status",
            maxResults: String(JIRA_SEARCH_MAX_RESULTS),
        });
        const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search?${params}`;
        const response = await this.getJson(url, accessToken);
        return response.issues ?? [];
    }
    async postJson(url, body) {
        const response = await this.fetchImpl(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(body),
        });
        return this.parseJsonOrThrow(response, url);
    }
    async getJson(url, accessToken) {
        const response = await this.fetchImpl(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
            },
        });
        return this.parseJsonOrThrow(response, url);
    }
    async parseJsonOrThrow(response, url) {
        if (!response.ok) {
            const text = await safeReadText(response);
            throw new AtlassianApiError(response.status, url, text);
        }
        return (await response.json());
    }
}
exports.AtlassianClient = AtlassianClient;
class AtlassianApiError extends Error {
    status;
    url;
    responseBody;
    constructor(status, url, responseBody) {
        super(`Atlassian ${url} responded ${status}: ${responseBody}`);
        this.status = status;
        this.url = url;
        this.responseBody = responseBody;
        this.name = "AtlassianApiError";
    }
}
exports.AtlassianApiError = AtlassianApiError;
async function safeReadText(response) {
    try {
        return await response.text();
    }
    catch {
        return "<unreadable response body>";
    }
}
/**
 * Build a JQL search expression. Empty query → most recently updated issues,
 * which gives the picker a useful default list. Non-empty → text match.
 *
 * Double quotes inside the query are stripped to avoid breaking JQL syntax;
 * we do not attempt full JQL escaping because we only ever quote one fragment.
 */
function buildJql(query) {
    const trimmed = query.trim();
    if (!trimmed)
        return "ORDER BY updated DESC";
    const safe = trimmed.replaceAll('"', "");
    return `text ~ "${safe}" ORDER BY updated DESC`;
}
//# sourceMappingURL=atlassianClient.js.map