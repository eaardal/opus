import {
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { ALLOWED_EMAILS, OWNER_EMAIL } from './data.js'
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

describe('default deny — unknown collections', () => {
  it('denies read from an unrecognised collection for an allowed user', async () => {
    const ctx = testEnv.authenticatedContext(OWNER_EMAIL, {
      email: ALLOWED_EMAILS.tv2,
      email_verified: true,
    })
    await assertFails(getDoc(doc(ctx.firestore(), `unknown/${OWNER_EMAIL}`)))
  })

  it('denies write to an unrecognised collection for an allowed user', async () => {
    const ctx = testEnv.authenticatedContext(OWNER_EMAIL, {
      email: ALLOWED_EMAILS.tv2,
      email_verified: true,
    })
    await assertFails(setDoc(doc(ctx.firestore(), 'unknown/doc-1'), { data: 'test' }))
  })

  it('denies unauthenticated read from an unrecognised collection', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'unknown/doc-1')))
  })

  it('denies unauthenticated write to an unrecognised collection', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(db, 'unknown/doc-1'), { data: 'test' }))
  })
})
