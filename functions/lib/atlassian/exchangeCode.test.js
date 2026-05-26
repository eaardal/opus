"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const exchangeCode_js_1 = require("./exchangeCode.js");
const FIXED_NOW = new Date("2026-01-01T12:00:00.000Z");
function makeAtlassianStub(overrides) {
    const exchanged = vitest_1.vi.fn().mockResolvedValue(overrides?.tokens ?? {
        access_token: "AT",
        refresh_token: "RT",
        expires_in: 3600,
        scope: "offline_access read:me",
        token_type: "Bearer",
    });
    return {
        exchanged,
        client: {
            exchangeAuthorizationCode: exchanged,
            getAccount: vitest_1.vi.fn().mockResolvedValue(overrides?.account ?? {
                account_id: "acct-1",
                email: "alice@example.com",
                name: "Alice",
            }),
            getAccessibleResources: vitest_1.vi.fn().mockResolvedValue(overrides?.resources ?? [{ id: "cloud-1", name: "Org", scopes: [], url: "" }]),
            refreshTokens: vitest_1.vi.fn(),
            revokeToken: vitest_1.vi.fn(),
        },
    };
}
function makeTokenStoreSpy() {
    return {
        save: vitest_1.vi.fn().mockResolvedValue(undefined),
        get: vitest_1.vi.fn().mockResolvedValue(null),
        delete: vitest_1.vi.fn().mockResolvedValue(undefined),
    };
}
(0, vitest_1.describe)("makeExchangeCodeHandler", () => {
    let tokenStore;
    (0, vitest_1.beforeEach)(() => {
        tokenStore = makeTokenStoreSpy();
    });
    (0, vitest_1.it)("exchanges the code, fetches account + resources, and persists tokens under the caller's email", async () => {
        const { client } = makeAtlassianStub();
        const handler = (0, exchangeCode_js_1.makeExchangeCodeHandler)({
            atlassian: client,
            tokens: tokenStore,
            now: () => FIXED_NOW,
        });
        const result = await handler("alice@example.com", {
            code: "auth-code",
            redirectUri: "https://app.example/cb",
            codeVerifier: "verifier",
        });
        (0, vitest_1.expect)(result).toEqual({
            accountId: "acct-1",
            accountEmail: "alice@example.com",
            accountName: "Alice",
            scope: "offline_access read:me",
            cloudId: "cloud-1",
        });
        (0, vitest_1.expect)(tokenStore.save).toHaveBeenCalledOnce();
        const [savedEmail, savedDoc] = tokenStore.save.mock.calls[0];
        (0, vitest_1.expect)(savedEmail).toBe("alice@example.com");
        (0, vitest_1.expect)(savedDoc).toMatchObject({
            accountId: "acct-1",
            accessToken: "AT",
            refreshToken: "RT",
            scope: "offline_access read:me",
            cloudId: "cloud-1",
        });
        (0, vitest_1.expect)(savedDoc.expiresAt.toMillis()).toBe(FIXED_NOW.getTime() + 3600 * 1000);
        (0, vitest_1.expect)(savedDoc.connectedAt.toMillis()).toBe(FIXED_NOW.getTime());
    });
    (0, vitest_1.it)("stores cloudId as null when there are no accessible resources", async () => {
        const { client } = makeAtlassianStub({ resources: [] });
        const handler = (0, exchangeCode_js_1.makeExchangeCodeHandler)({
            atlassian: client,
            tokens: tokenStore,
            now: () => FIXED_NOW,
        });
        const result = await handler("alice@example.com", {
            code: "c",
            redirectUri: "https://app.example/cb",
            codeVerifier: "v",
        });
        (0, vitest_1.expect)(result.cloudId).toBeNull();
        (0, vitest_1.expect)(tokenStore.save.mock.calls[0][1].cloudId).toBeNull();
    });
    (0, vitest_1.it)("propagates failures from the Atlassian token exchange", async () => {
        const { client, exchanged } = makeAtlassianStub();
        exchanged.mockRejectedValueOnce(new Error("invalid_grant"));
        const handler = (0, exchangeCode_js_1.makeExchangeCodeHandler)({
            atlassian: client,
            tokens: tokenStore,
            now: () => FIXED_NOW,
        });
        await (0, vitest_1.expect)(handler("alice@example.com", {
            code: "c",
            redirectUri: "https://app.example/cb",
            codeVerifier: "v",
        })).rejects.toThrow("invalid_grant");
        (0, vitest_1.expect)(tokenStore.save).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=exchangeCode.test.js.map