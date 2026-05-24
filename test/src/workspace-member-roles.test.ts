/**
 * Integration tests: workspace member role operations with dotted email keys.
 *
 * These tests run against the Firestore emulator and verify that addMember,
 * updateMemberRole, and removeMember write to the correct Firestore paths when
 * the member's email contains dots (e.g. "first.last@apparat.no").
 *
 * Firestore's updateDoc interprets top-level object keys as dotted field paths
 * and splits on every ".". An email like "user@tv2.no" would be split into
 * ["user@tv2", "no"], creating a ghost entry instead of updating the real one.
 * The fix uses FieldPath, which treats each constructor argument as a literal
 * key segment and never splits on dots.
 *
 * Run with the emulator already started:
 *   firebase emulators:start --only firestore
 *   cd test && npm test
 *
 * Or let the CI script manage the emulator lifecycle:
 *   cd test && npm run test:ci
 */

import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createTestEnv,
  readWorkspaceData,
  seedWorkspace,
  serviceAddMember,
  serviceRemoveMember,
  serviceUpdateMemberRole,
} from './helpers.js'

// "first.last@apparat.no" has two dots: one in the local-part and one in
// the TLD. This maximally exercises the path-splitting bug.
const OWNER_EMAIL = 'owner@tv2.no'
const MEMBER_EMAIL = 'first.last@apparat.no'
const WORKSPACE_ID = 'ws-1'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await createTestEnv()
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

// ── addMember ─────────────────────────────────────────────────────────────────

describe('addMember', () => {
  it('stores the new member under the full literal email key', async () => {
    await seedWorkspace(testEnv, WORKSPACE_ID, {
      ownerId: OWNER_EMAIL,
      members: { [OWNER_EMAIL]: { role: 'owner' } },
      memberIds: [OWNER_EMAIL],
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await serviceAddMember(ctx.firestore(), WORKSPACE_ID, MEMBER_EMAIL, 'viewer')
    })

    const data = await readWorkspaceData(testEnv, WORKSPACE_ID)
    expect(data).not.toBeNull()

    const members = data!['members'] as Record<string, { role: string }>
    expect(members[MEMBER_EMAIL]).toBeDefined()
    expect(members[MEMBER_EMAIL]!.role).toBe('viewer')
  })

  it('appends the email to memberIds', async () => {
    await seedWorkspace(testEnv, WORKSPACE_ID, {
      ownerId: OWNER_EMAIL,
      members: { [OWNER_EMAIL]: { role: 'owner' } },
      memberIds: [OWNER_EMAIL],
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await serviceAddMember(ctx.firestore(), WORKSPACE_ID, MEMBER_EMAIL, 'viewer')
    })

    const data = await readWorkspaceData(testEnv, WORKSPACE_ID)
    expect(data!['memberIds']).toContain(MEMBER_EMAIL)
  })

  it('does not create a ghost partial-email key in the members map', async () => {
    await seedWorkspace(testEnv, WORKSPACE_ID, {
      ownerId: OWNER_EMAIL,
      members: { [OWNER_EMAIL]: { role: 'owner' } },
      memberIds: [OWNER_EMAIL],
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await serviceAddMember(ctx.firestore(), WORKSPACE_ID, MEMBER_EMAIL, 'viewer')
    })

    const data = await readWorkspaceData(testEnv, WORKSPACE_ID)
    const memberKeys = Object.keys(data!['members'] as object)

    // Only the owner and the new member — no ghost key like "first" or "user@tv2"
    expect(memberKeys).toHaveLength(2)
    expect(memberKeys).toContain(OWNER_EMAIL)
    expect(memberKeys).toContain(MEMBER_EMAIL)
  })

  it('seeds both legacy owner and new member when the workspace has no members map', async () => {
    // Legacy workspace: ownerId present but no members map
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const { setDoc, doc, Timestamp } = await import('firebase/firestore')
      await setDoc(doc(ctx.firestore(), `workspaces/${WORKSPACE_ID}`), {
        ownerId: OWNER_EMAIL,
        name: 'Legacy Workspace',
        updatedAt: Timestamp.now(),
      })
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await serviceAddMember(ctx.firestore(), WORKSPACE_ID, MEMBER_EMAIL, 'editor')
    })

    const data = await readWorkspaceData(testEnv, WORKSPACE_ID)
    const members = data!['members'] as Record<string, { role: string }>

    expect(members[OWNER_EMAIL]!.role).toBe('owner')
    expect(members[MEMBER_EMAIL]!.role).toBe('editor')
    expect(data!['memberIds']).toEqual([OWNER_EMAIL, MEMBER_EMAIL])
  })
})

// ── updateMemberRole ──────────────────────────────────────────────────────────

describe('updateMemberRole', () => {
  it('changes the role of the correct member', async () => {
    await seedWorkspace(testEnv, WORKSPACE_ID, {
      ownerId: OWNER_EMAIL,
      members: {
        [OWNER_EMAIL]: { role: 'owner' },
        [MEMBER_EMAIL]: { role: 'viewer' },
      },
      memberIds: [OWNER_EMAIL, MEMBER_EMAIL],
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await serviceUpdateMemberRole(ctx.firestore(), WORKSPACE_ID, MEMBER_EMAIL, 'editor')
    })

    const data = await readWorkspaceData(testEnv, WORKSPACE_ID)
    const members = data!['members'] as Record<string, { role: string }>
    expect(members[MEMBER_EMAIL]!.role).toBe('editor')
  })

  it('leaves other members untouched', async () => {
    await seedWorkspace(testEnv, WORKSPACE_ID, {
      ownerId: OWNER_EMAIL,
      members: {
        [OWNER_EMAIL]: { role: 'owner' },
        [MEMBER_EMAIL]: { role: 'viewer' },
      },
      memberIds: [OWNER_EMAIL, MEMBER_EMAIL],
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await serviceUpdateMemberRole(ctx.firestore(), WORKSPACE_ID, MEMBER_EMAIL, 'editor')
    })

    const data = await readWorkspaceData(testEnv, WORKSPACE_ID)
    const members = data!['members'] as Record<string, { role: string }>
    expect(members[OWNER_EMAIL]!.role).toBe('owner')
  })

  it('does not create a ghost partial-email key in the members map', async () => {
    await seedWorkspace(testEnv, WORKSPACE_ID, {
      ownerId: OWNER_EMAIL,
      members: {
        [OWNER_EMAIL]: { role: 'owner' },
        [MEMBER_EMAIL]: { role: 'viewer' },
      },
      memberIds: [OWNER_EMAIL, MEMBER_EMAIL],
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await serviceUpdateMemberRole(ctx.firestore(), WORKSPACE_ID, MEMBER_EMAIL, 'editor')
    })

    const data = await readWorkspaceData(testEnv, WORKSPACE_ID)
    const memberKeys = Object.keys(data!['members'] as object)
    expect(memberKeys).toHaveLength(2)
    expect(memberKeys).toContain(OWNER_EMAIL)
    expect(memberKeys).toContain(MEMBER_EMAIL)
  })

  // ── Regression test: demonstrates the bug that FieldPath fixes ──────────────
  //
  // When a dotted template-string like "members.first.last@apparat.no.role" is
  // used as a Firestore field path, Firestore splits it on every "." into five
  // segments: ["members", "first", "last@apparat", "no", "role"].
  //
  // The result:
  //   - The real member entry ("first.last@apparat.no") is NOT updated.
  //   - A ghost nested entry is created at members["first"]["last@apparat"]["no"].
  //   - The ghost entry's role defaults to "viewer" in toMembers(), and its key
  //     ("first") is not a valid user email, so it renders as an empty user row.
  it('regression: dotted template-string path leaves the real role unchanged and creates a ghost entry', async () => {
    await seedWorkspace(testEnv, WORKSPACE_ID, {
      ownerId: OWNER_EMAIL,
      members: {
        [OWNER_EMAIL]: { role: 'owner' },
        [MEMBER_EMAIL]: { role: 'viewer' },
      },
      memberIds: [OWNER_EMAIL, MEMBER_EMAIL],
    })

    // Reproduce the old broken write: template-string dotted path, no FieldPath.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), `workspaces/${WORKSPACE_ID}`), {
        [`members.${MEMBER_EMAIL}.role`]: 'editor',
      })
    })

    const data = await readWorkspaceData(testEnv, WORKSPACE_ID)
    const members = data!['members'] as Record<string, unknown>

    // The real entry is unchanged — the update went to the wrong path.
    expect((members[MEMBER_EMAIL] as { role: string } | undefined)?.role).toBe('viewer')

    // A ghost key ("first") was created because Firestore split the path on dots.
    const memberKeys = Object.keys(members)
    expect(memberKeys.length).toBeGreaterThan(2)
    expect(memberKeys).toContain('first')
  })
})

// ── removeMember ─────────────────────────────────────────────────────────────

describe('removeMember', () => {
  it('deletes the member entry at the correct literal email key', async () => {
    await seedWorkspace(testEnv, WORKSPACE_ID, {
      ownerId: OWNER_EMAIL,
      members: {
        [OWNER_EMAIL]: { role: 'owner' },
        [MEMBER_EMAIL]: { role: 'editor' },
      },
      memberIds: [OWNER_EMAIL, MEMBER_EMAIL],
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await serviceRemoveMember(ctx.firestore(), WORKSPACE_ID, MEMBER_EMAIL)
    })

    const data = await readWorkspaceData(testEnv, WORKSPACE_ID)
    const members = data!['members'] as Record<string, unknown>
    expect(members[MEMBER_EMAIL]).toBeUndefined()
  })

  it('removes the email from memberIds', async () => {
    await seedWorkspace(testEnv, WORKSPACE_ID, {
      ownerId: OWNER_EMAIL,
      members: {
        [OWNER_EMAIL]: { role: 'owner' },
        [MEMBER_EMAIL]: { role: 'editor' },
      },
      memberIds: [OWNER_EMAIL, MEMBER_EMAIL],
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await serviceRemoveMember(ctx.firestore(), WORKSPACE_ID, MEMBER_EMAIL)
    })

    const data = await readWorkspaceData(testEnv, WORKSPACE_ID)
    expect(data!['memberIds']).not.toContain(MEMBER_EMAIL)
  })

  it('leaves the remaining members map intact', async () => {
    await seedWorkspace(testEnv, WORKSPACE_ID, {
      ownerId: OWNER_EMAIL,
      members: {
        [OWNER_EMAIL]: { role: 'owner' },
        [MEMBER_EMAIL]: { role: 'editor' },
      },
      memberIds: [OWNER_EMAIL, MEMBER_EMAIL],
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await serviceRemoveMember(ctx.firestore(), WORKSPACE_ID, MEMBER_EMAIL)
    })

    const data = await readWorkspaceData(testEnv, WORKSPACE_ID)
    const memberKeys = Object.keys(data!['members'] as object)
    expect(memberKeys).toHaveLength(1)
    expect(memberKeys).toContain(OWNER_EMAIL)
  })
})
