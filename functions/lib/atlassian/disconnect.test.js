"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firestore_1 = require("firebase-admin/firestore");
const vitest_1 = require("vitest");
const atlassianClient_js_1 = require("./atlassianClient.js");
const disconnect_js_1 = require("./disconnect.js");
const FIXED_TS = firestore_1.Timestamp.fromDate(new Date("2026-01-01T12:00:00.000Z"));
function existingIntegration() {
    return {
        accountId: "acct-1",
        accountEmail: "alice@example.com",
        accountName: "Alice",
        accessToken: "AT",
        refreshToken: "RT",
        scope: "offline_access",
        expiresAt: FIXED_TS,
        cloudId: "cloud-1",
        connectedAt: FIXED_TS,
        updatedAt: FIXED_TS,
    };
}
function makeAtlassianStub() {
    const revoke = vitest_1.vi.fn().mockResolvedValue(undefined);
    return {
        revoke,
        client: {
            revokeToken: revoke,
            exchangeAuthorizationCode: vitest_1.vi.fn(),
            refreshTokens: vitest_1.vi.fn(),
            getAccount: vitest_1.vi.fn(),
            getAccessibleResources: vitest_1.vi.fn(),
        },
    };
}
(0, vitest_1.describe)("makeDisconnectHandler", () => {
    let store;
    (0, vitest_1.beforeEach)(() => {
        store = {
            save: vitest_1.vi.fn(),
            get: vitest_1.vi.fn(),
            delete: vitest_1.vi.fn().mockResolvedValue(undefined),
        };
    });
    (0, vitest_1.it)("revokes the refresh token at Atlassian and deletes the local doc", async () => {
        store.get.mockResolvedValueOnce(existingIntegration());
        const { client, revoke } = makeAtlassianStub();
        const handler = (0, disconnect_js_1.makeDisconnectHandler)({ atlassian: client, tokens: store });
        const result = await handler("alice@example.com");
        (0, vitest_1.expect)(revoke).toHaveBeenCalledWith("RT");
        (0, vitest_1.expect)(store.delete).toHaveBeenCalledWith("alice@example.com");
        (0, vitest_1.expect)(result).toEqual({ removed: true });
    });
    (0, vitest_1.it)("returns removed=false when there is no stored integration", async () => {
        store.get.mockResolvedValueOnce(null);
        const { client, revoke } = makeAtlassianStub();
        const handler = (0, disconnect_js_1.makeDisconnectHandler)({ atlassian: client, tokens: store });
        const result = await handler("alice@example.com");
        (0, vitest_1.expect)(result).toEqual({ removed: false });
        (0, vitest_1.expect)(revoke).not.toHaveBeenCalled();
        (0, vitest_1.expect)(store.delete).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("deletes locally even if the Atlassian revoke call fails", async () => {
        store.get.mockResolvedValueOnce(existingIntegration());
        const { client, revoke } = makeAtlassianStub();
        revoke.mockRejectedValueOnce(new atlassianClient_js_1.AtlassianApiError(400, "https://x", "invalid_token"));
        const handler = (0, disconnect_js_1.makeDisconnectHandler)({ atlassian: client, tokens: store });
        const result = await handler("alice@example.com");
        (0, vitest_1.expect)(result).toEqual({ removed: true });
        (0, vitest_1.expect)(store.delete).toHaveBeenCalledOnce();
    });
});
//# sourceMappingURL=disconnect.test.js.map