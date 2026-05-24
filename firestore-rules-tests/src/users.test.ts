import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { ALLOWED_EMAILS, DENIED_EMAILS, makeUserDoc, OWNER_EMAIL } from './data.js'
import { createTestEnv } from './testEnv.js'

const OTHER_EMAIL = ALLOWED_EMAILS.apparat

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

function authCtx(email: string, emailVerified = true) {
  // Rules never read auth.uid, so we use the email as the auth uid too.
  return testEnv.authenticatedContext(email, { email, email_verified: emailVerified })
}

describe('/users/{userEmail}', () => {
  describe('isAllowedUser — access guard', () => {
    it('denies read when unauthenticated', async () => {
      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(getDoc(doc(db, `users/${OWNER_EMAIL}`)))
    })

    it('denies read when email is not verified', async () => {
      const db = authCtx(ALLOWED_EMAILS.tv2, false).firestore()
      await assertFails(getDoc(doc(db, `users/${OWNER_EMAIL}`)))
    })

    it('denies read from a non-allowlisted domain', async () => {
      const db = authCtx(DENIED_EMAILS.other).firestore()
      await assertFails(getDoc(doc(db, `users/${OWNER_EMAIL}`)))
    })

    it('denies read from a non-allowlisted Gmail address', async () => {
      const db = authCtx(DENIED_EMAILS.otherGmail).firestore()
      await assertFails(getDoc(doc(db, `users/${OWNER_EMAIL}`)))
    })

    it('allows read from the allowlisted Gmail address', async () => {
      const db = authCtx(ALLOWED_EMAILS.gmail).firestore()
      await assertSucceeds(getDoc(doc(db, `users/${OWNER_EMAIL}`)))
    })

    it('allows read from an @tv2.no address', async () => {
      const db = authCtx(ALLOWED_EMAILS.tv2).firestore()
      await assertSucceeds(getDoc(doc(db, `users/${OWNER_EMAIL}`)))
    })

    it('allows read from an @apparat.no address', async () => {
      const db = authCtx(ALLOWED_EMAILS.apparat).firestore()
      await assertSucceeds(getDoc(doc(db, `users/${OWNER_EMAIL}`)))
    })

    it('allows read when email has uppercase characters (rules lowercase the email)', async () => {
      const db = authCtx('USER@TV2.NO').firestore()
      await assertSucceeds(getDoc(doc(db, `users/${OWNER_EMAIL}`)))
    })
  })

  describe('read', () => {
    it('allows reading own document', async () => {
      const db = authCtx(OWNER_EMAIL).firestore()
      await assertSucceeds(getDoc(doc(db, `users/${OWNER_EMAIL}`)))
    })

    it('allows reading another user document (directory access for invites)', async () => {
      const db = authCtx(OWNER_EMAIL).firestore()
      await assertSucceeds(getDoc(doc(db, `users/${OTHER_EMAIL}`)))
    })
  })

  describe('create', () => {
    it('allows creating own document when path and data.email match auth token', async () => {
      const db = authCtx(OWNER_EMAIL).firestore()
      await assertSucceeds(
        setDoc(doc(db, `users/${OWNER_EMAIL}`), makeUserDoc(OWNER_EMAIL))
      )
    })

    it('denies creating a document at another user path', async () => {
      const db = authCtx(OWNER_EMAIL).firestore()
      await assertFails(
        setDoc(doc(db, `users/${OTHER_EMAIL}`), makeUserDoc(OTHER_EMAIL))
      )
    })

    it('denies creating own document when data.email does not match auth token email', async () => {
      const db = authCtx(OWNER_EMAIL).firestore()
      await assertFails(
        setDoc(doc(db, `users/${OWNER_EMAIL}`), makeUserDoc(OTHER_EMAIL))
      )
    })

    it('denies creating when unauthenticated', async () => {
      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(
        setDoc(doc(db, `users/${OWNER_EMAIL}`), makeUserDoc(OWNER_EMAIL))
      )
    })
  })

  describe('update', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore()
        await setDoc(doc(db, `users/${OWNER_EMAIL}`), makeUserDoc(OWNER_EMAIL))
        await setDoc(doc(db, `users/${OTHER_EMAIL}`), makeUserDoc(OTHER_EMAIL))
      })
    })

    it('allows updating own document when path and data.email match auth token', async () => {
      const db = authCtx(OWNER_EMAIL).firestore()
      await assertSucceeds(
        setDoc(doc(db, `users/${OWNER_EMAIL}`), makeUserDoc(OWNER_EMAIL))
      )
    })

    it('denies updating another user document', async () => {
      const db = authCtx(OWNER_EMAIL).firestore()
      await assertFails(
        setDoc(doc(db, `users/${OTHER_EMAIL}`), makeUserDoc(OTHER_EMAIL))
      )
    })

    it('denies updating own document with a different email in data', async () => {
      const db = authCtx(OWNER_EMAIL).firestore()
      await assertFails(
        setDoc(doc(db, `users/${OWNER_EMAIL}`), makeUserDoc(OTHER_EMAIL))
      )
    })
  })

  describe('delete', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(
          doc(ctx.firestore(), `users/${OWNER_EMAIL}`),
          makeUserDoc(OWNER_EMAIL)
        )
      })
    })

    it('denies deletion by the document owner', async () => {
      const db = authCtx(OWNER_EMAIL).firestore()
      await assertFails(deleteDoc(doc(db, `users/${OWNER_EMAIL}`)))
    })

    it('denies deletion when unauthenticated', async () => {
      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(deleteDoc(doc(db, `users/${OWNER_EMAIL}`)))
    })
  })
})
