import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  ALLOWED_EMAILS,
  EDITOR_UID,
  makeLegacyWorkspaceDoc,
  makeWorkspaceDoc,
  OUTSIDER_UID,
  OWNER_UID,
  WORKSPACE_ID,
} from './data.js'
import { createTestEnv } from './testEnv.js'

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

function ownerCtx() {
  return testEnv.authenticatedContext(OWNER_UID, {
    email: ALLOWED_EMAILS.tv2,
    email_verified: true,
  })
}

function editorCtx() {
  return testEnv.authenticatedContext(EDITOR_UID, {
    email: ALLOWED_EMAILS.apparat,
    email_verified: true,
  })
}

function outsiderCtx() {
  return testEnv.authenticatedContext(OUTSIDER_UID, {
    email: ALLOWED_EMAILS.gmail,
    email_verified: true,
  })
}

async function seedWorkspace(data?: Record<string, unknown>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), `workspaces/${WORKSPACE_ID}`),
      data ?? makeWorkspaceDoc(OWNER_UID, EDITOR_UID)
    )
  })
}

describe('/workspaces/{workspaceId}', () => {
  describe('create', () => {
    it('allows owner to create a workspace with correct fields', async () => {
      const db = ownerCtx().firestore()
      await assertSucceeds(
        setDoc(doc(db, `workspaces/${WORKSPACE_ID}`), makeWorkspaceDoc(OWNER_UID))
      )
    })

    it('denies create when ownerId does not match auth uid', async () => {
      const db = ownerCtx().firestore()
      await assertFails(
        setDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          ...makeWorkspaceDoc(OWNER_UID),
          ownerId: EDITOR_UID,
        })
      )
    })

    it('denies create when auth uid is absent from memberIds', async () => {
      const db = ownerCtx().firestore()
      await assertFails(
        setDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          ...makeWorkspaceDoc(OWNER_UID),
          memberIds: [],
        })
      )
    })

    it('denies create when auth uid is absent from members map', async () => {
      const db = ownerCtx().firestore()
      await assertFails(
        setDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          ...makeWorkspaceDoc(OWNER_UID),
          members: {},
        })
      )
    })

    it('denies create when creator role is not owner', async () => {
      const db = ownerCtx().firestore()
      await assertFails(
        setDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          ...makeWorkspaceDoc(OWNER_UID),
          members: { [OWNER_UID]: { role: 'editor' } },
        })
      )
    })

    it('denies create when unauthenticated', async () => {
      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(
        setDoc(doc(db, `workspaces/${WORKSPACE_ID}`), makeWorkspaceDoc(OWNER_UID))
      )
    })

    it('denies create from a non-allowlisted email domain', async () => {
      const ctx = testEnv.authenticatedContext(OUTSIDER_UID, {
        email: 'user@other.com',
        email_verified: true,
      })
      await assertFails(
        setDoc(doc(ctx.firestore(), `workspaces/${WORKSPACE_ID}`), makeWorkspaceDoc(OUTSIDER_UID))
      )
    })
  })

  describe('read', () => {
    it('allows member in memberIds to read', async () => {
      await seedWorkspace()
      await assertSucceeds(getDoc(doc(ownerCtx().firestore(), `workspaces/${WORKSPACE_ID}`)))
    })

    it('allows editor in memberIds to read', async () => {
      await seedWorkspace()
      await assertSucceeds(getDoc(doc(editorCtx().firestore(), `workspaces/${WORKSPACE_ID}`)))
    })

    it('allows legacy owner (ownerId match, no memberIds field) to read', async () => {
      await seedWorkspace(makeLegacyWorkspaceDoc(OWNER_UID))
      await assertSucceeds(getDoc(doc(ownerCtx().firestore(), `workspaces/${WORKSPACE_ID}`)))
    })

    it('allows original creator to read even after being removed from memberIds', async () => {
      // Simulates case (b) from the rule comment: creator removed from members but ownerId persists.
      await seedWorkspace({
        ...makeWorkspaceDoc(OWNER_UID, EDITOR_UID),
        memberIds: [EDITOR_UID],
        members: { [EDITOR_UID]: { role: 'editor' } },
        ownerId: OWNER_UID,
      })
      await assertSucceeds(getDoc(doc(ownerCtx().firestore(), `workspaces/${WORKSPACE_ID}`)))
    })

    it('denies read for a non-member', async () => {
      await seedWorkspace()
      await assertFails(getDoc(doc(outsiderCtx().firestore(), `workspaces/${WORKSPACE_ID}`)))
    })

    it('denies read when unauthenticated', async () => {
      await seedWorkspace()
      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(getDoc(doc(db, `workspaces/${WORKSPACE_ID}`)))
    })
  })

  describe('update — editor', () => {
    beforeEach(async () => {
      await seedWorkspace(makeWorkspaceDoc(OWNER_UID, EDITOR_UID))
    })

    it('allows editor to update name and updatedAt', async () => {
      const db = editorCtx().firestore()
      await assertSucceeds(
        updateDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          name: 'Renamed',
          updatedAt: new Date(),
        })
      )
    })

    it('allows editor to update projects', async () => {
      const db = editorCtx().firestore()
      await assertSucceeds(
        updateDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          projects: [{ id: 'p-1' }],
          updatedAt: new Date(),
        })
      )
    })

    it('allows editor to update people', async () => {
      const db = editorCtx().firestore()
      await assertSucceeds(
        updateDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          people: [{ id: 'person-1' }],
          updatedAt: new Date(),
        })
      )
    })

    it('allows editor to update teams', async () => {
      const db = editorCtx().firestore()
      await assertSucceeds(
        updateDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          teams: [{ id: 'team-1' }],
          updatedAt: new Date(),
        })
      )
    })

    it('denies editor from updating members map', async () => {
      const db = editorCtx().firestore()
      await assertFails(
        updateDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          members: { [EDITOR_UID]: { role: 'owner' } },
          updatedAt: new Date(),
        })
      )
    })

    it('denies editor from updating memberIds', async () => {
      const db = editorCtx().firestore()
      await assertFails(
        updateDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          memberIds: [EDITOR_UID, OUTSIDER_UID],
          updatedAt: new Date(),
        })
      )
    })

    it('denies editor from updating ownerId', async () => {
      const db = editorCtx().firestore()
      await assertFails(
        updateDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          ownerId: EDITOR_UID,
          updatedAt: new Date(),
        })
      )
    })
  })

  describe('update — owner', () => {
    beforeEach(async () => {
      await seedWorkspace(makeWorkspaceDoc(OWNER_UID, EDITOR_UID))
    })

    it('allows owner to update content fields', async () => {
      const db = ownerCtx().firestore()
      await assertSucceeds(
        updateDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          name: 'Owner Renamed',
          updatedAt: new Date(),
        })
      )
    })

    it('allows owner to update members and memberIds', async () => {
      const db = ownerCtx().firestore()
      await assertSucceeds(
        updateDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          members: {
            [OWNER_UID]: { role: 'owner' },
            [EDITOR_UID]: { role: 'editor' },
            [OUTSIDER_UID]: { role: 'editor' },
          },
          memberIds: [OWNER_UID, EDITOR_UID, OUTSIDER_UID],
          updatedAt: new Date(),
        })
      )
    })

    it('denies owner from changing ownerId to a different value', async () => {
      const db = ownerCtx().firestore()
      await assertFails(
        updateDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          ownerId: EDITOR_UID,
          updatedAt: new Date(),
        })
      )
    })
  })

  describe('update — legacy owner (no memberIds field)', () => {
    beforeEach(async () => {
      await seedWorkspace(makeLegacyWorkspaceDoc(OWNER_UID))
    })

    it('allows legacy owner to update content fields', async () => {
      const db = ownerCtx().firestore()
      await assertSucceeds(
        updateDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          name: 'Legacy Renamed',
          updatedAt: new Date(),
        })
      )
    })

    it('allows legacy owner to add memberIds and members (lazy upgrade to role-managed)', async () => {
      const db = ownerCtx().firestore()
      await assertSucceeds(
        updateDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          memberIds: [OWNER_UID, EDITOR_UID],
          members: {
            [OWNER_UID]: { role: 'owner' },
            [EDITOR_UID]: { role: 'editor' },
          },
          updatedAt: new Date(),
        })
      )
    })
  })

  describe('update — non-member', () => {
    beforeEach(async () => {
      await seedWorkspace()
    })

    it('denies non-member from updating workspace', async () => {
      const db = outsiderCtx().firestore()
      await assertFails(
        updateDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          name: 'Injected',
          updatedAt: new Date(),
        })
      )
    })

    it('denies update when unauthenticated', async () => {
      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(
        updateDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          name: 'Injected',
          updatedAt: new Date(),
        })
      )
    })
  })

  describe('delete', () => {
    beforeEach(async () => {
      await seedWorkspace()
    })

    it('allows owner to delete workspace', async () => {
      await assertSucceeds(deleteDoc(doc(ownerCtx().firestore(), `workspaces/${WORKSPACE_ID}`)))
    })

    it('denies editor from deleting workspace', async () => {
      await assertFails(deleteDoc(doc(editorCtx().firestore(), `workspaces/${WORKSPACE_ID}`)))
    })

    it('denies non-member from deleting workspace', async () => {
      await assertFails(deleteDoc(doc(outsiderCtx().firestore(), `workspaces/${WORKSPACE_ID}`)))
    })

    it('denies delete when unauthenticated', async () => {
      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(deleteDoc(doc(db, `workspaces/${WORKSPACE_ID}`)))
    })

    it('allows legacy owner to delete workspace', async () => {
      await testEnv.clearFirestore()
      await seedWorkspace(makeLegacyWorkspaceDoc(OWNER_UID))
      await assertSucceeds(deleteDoc(doc(ownerCtx().firestore(), `workspaces/${WORKSPACE_ID}`)))
    })
  })
})
