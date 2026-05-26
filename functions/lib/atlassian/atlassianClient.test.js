"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const atlassianClient_js_1 = require("./atlassianClient.js");
function fakeOkJson(body) {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}
function fakeError(status, body) {
    return new Response(body, { status });
}
(0, vitest_1.describe)("AtlassianClient", () => {
    let fetchMock;
    let client;
    (0, vitest_1.beforeEach)(() => {
        fetchMock = vitest_1.vi.fn();
        client = new atlassianClient_js_1.AtlassianClient({
            clientId: "test-client",
            clientSecret: "test-secret",
            fetchImpl: fetchMock,
        });
    });
    (0, vitest_1.describe)("exchangeAuthorizationCode", () => {
        (0, vitest_1.it)("POSTs to the token endpoint with the expected payload", async () => {
            fetchMock.mockResolvedValueOnce(fakeOkJson({
                access_token: "AT",
                refresh_token: "RT",
                expires_in: 3600,
                scope: "offline_access read:me",
                token_type: "Bearer",
            }));
            const tokens = await client.exchangeAuthorizationCode({
                code: "auth-code",
                redirectUri: "https://app.example/cb",
                codeVerifier: "verifier",
            });
            (0, vitest_1.expect)(tokens.access_token).toBe("AT");
            (0, vitest_1.expect)(fetchMock).toHaveBeenCalledOnce();
            const [url, init] = fetchMock.mock.calls[0];
            (0, vitest_1.expect)(url).toBe(atlassianClient_js_1.ATLASSIAN_TOKEN_URL);
            (0, vitest_1.expect)(init.method).toBe("POST");
            const body = JSON.parse(init.body);
            (0, vitest_1.expect)(body).toEqual({
                grant_type: "authorization_code",
                client_id: "test-client",
                client_secret: "test-secret",
                code: "auth-code",
                redirect_uri: "https://app.example/cb",
                code_verifier: "verifier",
            });
        });
        (0, vitest_1.it)("throws AtlassianApiError on non-2xx with body included", async () => {
            fetchMock.mockResolvedValueOnce(fakeError(400, "invalid_grant"));
            await (0, vitest_1.expect)(client.exchangeAuthorizationCode({
                code: "x",
                redirectUri: "https://app.example/cb",
                codeVerifier: "v",
            })).rejects.toBeInstanceOf(atlassianClient_js_1.AtlassianApiError);
        });
    });
    (0, vitest_1.describe)("refreshTokens", () => {
        (0, vitest_1.it)("POSTs the refresh_token grant", async () => {
            fetchMock.mockResolvedValueOnce(fakeOkJson({
                access_token: "AT2",
                refresh_token: "RT2",
                expires_in: 3600,
                scope: "offline_access read:me",
                token_type: "Bearer",
            }));
            const tokens = await client.refreshTokens("old-rt");
            (0, vitest_1.expect)(tokens.refresh_token).toBe("RT2");
            const body = JSON.parse(fetchMock.mock.calls[0][1].body);
            (0, vitest_1.expect)(body.grant_type).toBe("refresh_token");
            (0, vitest_1.expect)(body.refresh_token).toBe("old-rt");
        });
    });
    (0, vitest_1.describe)("revokeToken", () => {
        (0, vitest_1.it)("POSTs to the revoke endpoint", async () => {
            fetchMock.mockResolvedValueOnce(fakeOkJson({}));
            await client.revokeToken("rt-1");
            const [url, init] = fetchMock.mock.calls[0];
            (0, vitest_1.expect)(url).toBe(atlassianClient_js_1.ATLASSIAN_REVOKE_URL);
            const body = JSON.parse(init.body);
            (0, vitest_1.expect)(body.token).toBe("rt-1");
        });
    });
    (0, vitest_1.describe)("getAccount", () => {
        (0, vitest_1.it)("GETs /me with the access token", async () => {
            fetchMock.mockResolvedValueOnce(fakeOkJson({ account_id: "a1", email: "a@b.c", name: "Alice" }));
            const me = await client.getAccount("AT");
            (0, vitest_1.expect)(me.email).toBe("a@b.c");
            const [url, init] = fetchMock.mock.calls[0];
            (0, vitest_1.expect)(url).toBe(atlassianClient_js_1.ATLASSIAN_ME_URL);
            (0, vitest_1.expect)(init.headers.Authorization).toBe("Bearer AT");
        });
    });
    (0, vitest_1.describe)("getAccessibleResources", () => {
        (0, vitest_1.it)("GETs the resources endpoint and returns the array", async () => {
            fetchMock.mockResolvedValueOnce(fakeOkJson([{ id: "cloud-1", name: "My Org", scopes: [], url: "https://x" }]));
            const resources = await client.getAccessibleResources("AT");
            (0, vitest_1.expect)(resources).toHaveLength(1);
            (0, vitest_1.expect)(fetchMock.mock.calls[0][0]).toBe(atlassianClient_js_1.ATLASSIAN_ACCESSIBLE_RESOURCES_URL);
        });
    });
});
//# sourceMappingURL=atlassianClient.test.js.map