"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firestore_1 = require("firebase-admin/firestore");
const vitest_1 = require("vitest");
const searchIssues_js_1 = require("./searchIssues.js");
const FIXED_NOW = new Date("2026-01-01T12:00:00.000Z");
function makeIntegration(overrides) {
    const baseTs = firestore_1.Timestamp.fromDate(FIXED_NOW);
    return {
        accountId: "acct-1",
        accountEmail: "alice@example.com",
        accountName: "Alice",
        accessToken: "AT-fresh",
        refreshToken: "RT",
        scope: "offline_access read:jira-work",
        expiresAt: firestore_1.Timestamp.fromMillis(FIXED_NOW.getTime() + 60 * 60 * 1000),
        cloudId: "cloud-1",
        connectedAt: baseTs,
        updatedAt: baseTs,
        ...overrides,
    };
}
function makeAtlassianStub(issues = []) {
    const searched = vitest_1.vi.fn().mockResolvedValue(issues);
    return {
        searched,
        client: {
            searchJiraIssues: searched,
            refreshTokens: vitest_1.vi.fn(),
            exchangeAuthorizationCode: vitest_1.vi.fn(),
            getAccount: vitest_1.vi.fn(),
            getAccessibleResources: vitest_1.vi.fn(),
            revokeToken: vitest_1.vi.fn(),
        },
    };
}
function makeTokenStoreSpy(integration = makeIntegration()) {
    return {
        save: vitest_1.vi.fn().mockResolvedValue(undefined),
        get: vitest_1.vi.fn().mockResolvedValue(integration),
        delete: vitest_1.vi.fn().mockResolvedValue(undefined),
    };
}
const ISSUE = {
    id: "10001",
    key: "PROJ-42",
    fields: { summary: "Wire up search", status: { name: "In Progress" } },
};
(0, vitest_1.describe)("makeSearchIssuesHandler", () => {
    let tokenStore;
    (0, vitest_1.beforeEach)(() => {
        tokenStore = makeTokenStoreSpy();
    });
    (0, vitest_1.it)("maps Jira issues to candidates and includes the source url", async () => {
        const { client, searched } = makeAtlassianStub([ISSUE]);
        const handler = (0, searchIssues_js_1.makeSearchIssuesHandler)({
            atlassian: client,
            tokens: tokenStore,
            now: () => FIXED_NOW,
        });
        const result = await handler("alice@example.com", { query: "search" });
        (0, vitest_1.expect)(searched).toHaveBeenCalledWith("AT-fresh", "cloud-1", "search");
        (0, vitest_1.expect)(result).toEqual({
            issues: [
                {
                    externalId: "PROJ-42",
                    title: "Wire up search",
                    status: "In Progress",
                    url: vitest_1.expect.stringContaining("/browse/PROJ-42"),
                },
            ],
        });
    });
    (0, vitest_1.it)("rejects when the user has no Atlassian integration", async () => {
        const empty = makeTokenStoreSpy(null);
        const { client } = makeAtlassianStub();
        const handler = (0, searchIssues_js_1.makeSearchIssuesHandler)({
            atlassian: client,
            tokens: empty,
            now: () => FIXED_NOW,
        });
        await (0, vitest_1.expect)(handler("alice@example.com", { query: "" })).rejects.toThrow(/not connected/i);
    });
    (0, vitest_1.it)("rejects when the integration has no Jira cloudId", async () => {
        const noCloud = makeTokenStoreSpy(makeIntegration({ cloudId: null }));
        const { client } = makeAtlassianStub();
        const handler = (0, searchIssues_js_1.makeSearchIssuesHandler)({
            atlassian: client,
            tokens: noCloud,
            now: () => FIXED_NOW,
        });
        await (0, vitest_1.expect)(handler("alice@example.com", { query: "" })).rejects.toThrow(/no Jira site/i);
    });
    (0, vitest_1.it)("refreshes the token if the stored one is about to expire", async () => {
        const expiring = makeTokenStoreSpy(makeIntegration({
            accessToken: "AT-stale",
            expiresAt: firestore_1.Timestamp.fromMillis(FIXED_NOW.getTime() + 30 * 1000), // 30s left
        }));
        const { client, searched } = makeAtlassianStub([]);
        client.refreshTokens.mockResolvedValue({
            access_token: "AT-rotated",
            refresh_token: "RT-rotated",
            expires_in: 3600,
            scope: "offline_access read:jira-work",
            token_type: "Bearer",
        });
        const handler = (0, searchIssues_js_1.makeSearchIssuesHandler)({
            atlassian: client,
            tokens: expiring,
            now: () => FIXED_NOW,
        });
        await handler("alice@example.com", { query: "" });
        (0, vitest_1.expect)(client.refreshTokens).toHaveBeenCalledWith("RT");
        (0, vitest_1.expect)(searched).toHaveBeenCalledWith("AT-rotated", "cloud-1", "");
        (0, vitest_1.expect)(expiring.save).toHaveBeenCalledOnce();
    });
});
//# sourceMappingURL=searchIssues.test.js.map