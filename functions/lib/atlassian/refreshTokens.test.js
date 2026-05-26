"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firestore_1 = require("firebase-admin/firestore");
const vitest_1 = require("vitest");
const refreshTokens_js_1 = require("./refreshTokens.js");
const FIXED_NOW = new Date("2026-01-01T12:00:00.000Z");
function makeIntegration(overrides) {
    const baseTs = firestore_1.Timestamp.fromDate(FIXED_NOW);
    return {
        accountId: "acct-1",
        accountEmail: "alice@example.com",
        accountName: "Alice",
        accessToken: "AT-old",
        refreshToken: "RT-old",
        scope: "offline_access",
        expiresAt: firestore_1.Timestamp.fromMillis(FIXED_NOW.getTime() + 30 * 60 * 1000), // 30 min
        cloudId: "cloud-1",
        connectedAt: baseTs,
        updatedAt: baseTs,
        ...overrides,
    };
}
function makeAtlassianStub(tokens) {
    const refresh = vitest_1.vi.fn().mockResolvedValue(tokens ?? {
        access_token: "AT-new",
        refresh_token: "RT-new",
        expires_in: 3600,
        scope: "offline_access read:me",
        token_type: "Bearer",
    });
    return {
        refresh,
        client: {
            refreshTokens: refresh,
            exchangeAuthorizationCode: vitest_1.vi.fn(),
            revokeToken: vitest_1.vi.fn(),
            getAccount: vitest_1.vi.fn(),
            getAccessibleResources: vitest_1.vi.fn(),
        },
    };
}
(0, vitest_1.describe)("makeRefreshTokensHandler", () => {
    let store;
    (0, vitest_1.beforeEach)(() => {
        store = {
            save: vitest_1.vi.fn().mockResolvedValue(undefined),
            get: vitest_1.vi.fn(),
            delete: vitest_1.vi.fn(),
        };
    });
    (0, vitest_1.it)("skips the refresh when the existing token is comfortably valid", async () => {
        store.get.mockResolvedValueOnce(makeIntegration());
        const { client, refresh } = makeAtlassianStub();
        const handler = (0, refreshTokens_js_1.makeRefreshTokensHandler)({
            atlassian: client,
            tokens: store,
            now: () => FIXED_NOW,
        });
        const result = await handler("alice@example.com", {});
        (0, vitest_1.expect)(result.refreshed).toBe(false);
        (0, vitest_1.expect)(refresh).not.toHaveBeenCalled();
        (0, vitest_1.expect)(store.save).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("refreshes when the token is within the leeway window", async () => {
        // Expires in 2 minutes — well inside the 5-minute leeway.
        store.get.mockResolvedValueOnce(makeIntegration({
            expiresAt: firestore_1.Timestamp.fromMillis(FIXED_NOW.getTime() + 2 * 60 * 1000),
        }));
        const { client, refresh } = makeAtlassianStub();
        const handler = (0, refreshTokens_js_1.makeRefreshTokensHandler)({
            atlassian: client,
            tokens: store,
            now: () => FIXED_NOW,
        });
        const result = await handler("alice@example.com", {});
        (0, vitest_1.expect)(result.refreshed).toBe(true);
        (0, vitest_1.expect)(refresh).toHaveBeenCalledWith("RT-old");
        (0, vitest_1.expect)(store.save).toHaveBeenCalledOnce();
        const saved = store.save.mock.calls[0][1];
        (0, vitest_1.expect)(saved.accessToken).toBe("AT-new");
        (0, vitest_1.expect)(saved.refreshToken).toBe("RT-new");
        (0, vitest_1.expect)(saved.expiresAt.toMillis()).toBe(FIXED_NOW.getTime() + 3600 * 1000);
    });
    (0, vitest_1.it)("force=true refreshes even when token is fresh", async () => {
        store.get.mockResolvedValueOnce(makeIntegration());
        const { client, refresh } = makeAtlassianStub();
        const handler = (0, refreshTokens_js_1.makeRefreshTokensHandler)({
            atlassian: client,
            tokens: store,
            now: () => FIXED_NOW,
        });
        await handler("alice@example.com", { force: true });
        (0, vitest_1.expect)(refresh).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(store.save).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)("keeps the previous refresh token when Atlassian does not rotate it", async () => {
        store.get.mockResolvedValueOnce(makeIntegration({ expiresAt: firestore_1.Timestamp.fromMillis(FIXED_NOW.getTime() - 1) }));
        const { client } = makeAtlassianStub({
            access_token: "AT-new",
            refresh_token: undefined, // simulate omitted rotation
            expires_in: 3600,
            scope: "offline_access",
            token_type: "Bearer",
        });
        const handler = (0, refreshTokens_js_1.makeRefreshTokensHandler)({
            atlassian: client,
            tokens: store,
            now: () => FIXED_NOW,
        });
        await handler("alice@example.com", {});
        const saved = store.save.mock.calls[0][1];
        (0, vitest_1.expect)(saved.refreshToken).toBe("RT-old");
    });
    (0, vitest_1.it)("throws failed-precondition when there is no stored integration", async () => {
        store.get.mockResolvedValueOnce(null);
        const { client } = makeAtlassianStub();
        const handler = (0, refreshTokens_js_1.makeRefreshTokensHandler)({
            atlassian: client,
            tokens: store,
            now: () => FIXED_NOW,
        });
        await (0, vitest_1.expect)(handler("alice@example.com", {})).rejects.toThrow(/not connected/i);
    });
});
//# sourceMappingURL=refreshTokens.test.js.map