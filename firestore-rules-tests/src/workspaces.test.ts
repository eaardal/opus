import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  EDITOR_EMAIL,
  makeLegacyWorkspaceDoc,
  makeWorkspaceDoc,
  OUTSIDER_EMAIL,
  OWNER_EMAIL,
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

// Rules never read auth.uid, so we use the email as the auth uid too.
function ownerCtx() {
  return testEnv.authenticatedContext(OWNER_EMAIL, {
    email: OWNER_EMAIL,
    email_verified: true,
  })
}

function editorCtx() {
  return testEnv.authenticatedContext(EDITOR_EMAIL, {
    email: EDITOR_EMAIL,
    email_verified: true,
  })
}

function outsiderCtx() {
  return testEnv.authenticatedContext(OUTSIDER_EMAIL, {
    email: OUTSIDER_EMAIL,
    email_verified: true,
  })
}

async function seedWorkspace(data?: Record<string, unknown>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), `workspaces/${WORKSPACE_ID}`),
      data ?? makeWorkspaceDoc(OWNER_EMAIL, EDITOR_EMAIL)
    )
  })
}

describe('/workspaces/{workspaceId}', () => {
  describe('create', () => {
    it('allows owner to create a workspace with correct fields', async () => {
      const db = ownerCtx().firestore()
      await assertSucceeds(
        setDoc(doc(db, `workspaces/${WORKSPACE_ID}`), makeWorkspaceDoc(OWNER_EMAIL))
      )
    })

    it('denies create when ownerId does not match auth email', async () => {
      const db = ownerCtx().firestore()
      await assertFails(
        setDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          ...makeWorkspaceDoc(OWNER_EMAIL),
          ownerId: EDITOR_EMAIL,
        })
      )
    })

    it('denies create when auth email is absent from memberIds', async () => {
      const db = ownerCtx().firestore()
      await assertFails(
        setDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          ...makeWorkspaceDoc(OWNER_EMAIL),
          memberIds: [],
        })
      )
    })

    it('denies create when auth email is absent from members map', async () => {
      const db = ownerCtx().firestore()
      await assertFails(
        setDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          ...makeWorkspaceDoc(OWNER_EMAIL),
          members: {},
        })
      )
    })

    it('denies create when creator role is not owner', async () => {
      const db = ownerCtx().firestore()
      await assertFails(
        setDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          ...makeWorkspaceDoc(OWNER_EMAIL),
          members: { [OWNER_EMAIL]: { role: 'editor' } },
        })
      )
    })

    it('denies create when unauthenticated', async () => {
      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(
        setDoc(doc(db, `workspaces/${WORKSPACE_ID}`), makeWorkspaceDoc(OWNER_EMAIL))
      )
    })

    it('denies create from a non-allowlisted email domain', async () => {
      const ctx = testEnv.authenticatedContext('user@other.com', {
        email: 'user@other.com',
        email_verified: true,
      })
      await assertFails(
        setDoc(
          doc(ctx.firestore(), `workspaces/${WORKSPACE_ID}`),
          makeWorkspaceDoc('user@other.com')
        )
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
      await seedWorkspace(makeLegacyWorkspaceDoc(OWNER_EMAIL))
      await assertSucceeds(getDoc(doc(ownerCtx().firestore(), `workspaces/${WORKSPACE_ID}`)))
    })

    it('allows original creator to read even after being removed from memberIds', async () => {
      // Simulates case (b) from the rule comment: creator removed from members but ownerId persists.
      await seedWorkspace({
        ...makeWorkspaceDoc(OWNER_EMAIL, EDITOR_EMAIL),
        memberIds: [EDITOR_EMAIL],
        members: { [EDITOR_EMAIL]: { role: 'editor' } },
        ownerId: OWNER_EMAIL,
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
      await seedWorkspace(makeWorkspaceDoc(OWNER_EMAIL, EDITOR_EMAIL))
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

    it('denies editor from updating members map', async () => {
      const db = editorCtx().firestore()
      await assertFails(
        updateDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          members: { [EDITOR_EMAIL]: { role: 'owner' } },
          updatedAt: new Date(),
        })
      )
    })

    it('denies editor from updating memberIds', async () => {
      const db = editorCtx().firestore()
      await assertFails(
        updateDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          memberIds: [EDITOR_EMAIL, OUTSIDER_EMAIL],
          updatedAt: new Date(),
        })
      )
    })

    it('denies editor from updating ownerId', async () => {
      const db = editorCtx().firestore()
      await assertFails(
        updateDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          ownerId: EDITOR_EMAIL,
          updatedAt: new Date(),
        })
      )
    })
  })

  describe('update — owner', () => {
    beforeEach(async () => {
      await seedWorkspace(makeWorkspaceDoc(OWNER_EMAIL, EDITOR_EMAIL))
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
            [OWNER_EMAIL]: { role: 'owner' },
            [EDITOR_EMAIL]: { role: 'editor' },
            [OUTSIDER_EMAIL]: { role: 'editor' },
          },
          memberIds: [OWNER_EMAIL, EDITOR_EMAIL, OUTSIDER_EMAIL],
          updatedAt: new Date(),
        })
      )
    })

    it('denies owner from changing ownerId to a different value', async () => {
      const db = ownerCtx().firestore()
      await assertFails(
        updateDoc(doc(db, `workspaces/${WORKSPACE_ID}`), {
          ownerId: EDITOR_EMAIL,
          updatedAt: new Date(),
        })
      )
    })
  })

  describe('update — legacy owner (no memberIds field)', () => {
    beforeEach(async () => {
      await seedWorkspace(makeLegacyWorkspaceDoc(OWNER_EMAIL))
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
          memberIds: [OWNER_EMAIL, EDITOR_EMAIL],
          members: {
            [OWNER_EMAIL]: { role: 'owner' },
            [EDITOR_EMAIL]: { role: 'editor' },
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
      await seedWorkspace(makeLegacyWorkspaceDoc(OWNER_EMAIL))
      await assertSucceeds(deleteDoc(doc(ownerCtx().firestore(), `workspaces/${WORKSPACE_ID}`)))
    })
  })
})
