import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  arrayRemove,
  arrayUnion,
  deleteField,
  doc,
  FieldPath,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RULES_PATH = resolve(__dirname, '../../firestore.rules')

export type Role = 'owner' | 'editor' | 'viewer'

function uniqueProjectId(): string {
  return `domino-test-${Date.now()}-${Math.floor(Math.random() * 100_000)}`
}

export function createTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: uniqueProjectId(),
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  })
}

export interface WorkspaceSeed {
  ownerId: string
  members: Record<string, { role: Role; addedAt?: Timestamp }>
  memberIds: string[]
}

export async function seedWorkspace(
  testEnv: RulesTestEnvironment,
  workspaceId: string,
  seed: WorkspaceSeed,
): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const members: Record<string, { role: Role; addedAt: Timestamp }> = {}
    for (const [email, m] of Object.entries(seed.members)) {
      members[email] = { role: m.role, addedAt: m.addedAt ?? Timestamp.now() }
    }
    await setDoc(doc(ctx.firestore(), `workspaces/${workspaceId}`), {
      ownerId: seed.ownerId,
      name: 'Test Workspace',
      memberIds: seed.memberIds,
      members,
      updatedAt: Timestamp.now(),
    })
  })
}

export async function readWorkspaceData(
  testEnv: RulesTestEnvironment,
  workspaceId: string,
): Promise<DocumentData | null> {
  let result: DocumentData | null = null
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const snap = await getDoc(doc(ctx.firestore(), `workspaces/${workspaceId}`))
    result = snap.exists() ? snap.data() : null
  })
  return result
}

// ── Service-equivalent write operations ──────────────────────────────────────
// These mirror workspaceService.ts precisely. FieldPath is used for all nested
// member paths so that email addresses containing dots (e.g. "user@tv2.no") are
// stored under their literal string key rather than being split by Firestore's
// dotted field-path parser.

export async function serviceAddMember(
  db: Firestore,
  workspaceId: string,
  email: string,
  role: Role,
): Promise<void> {
  const wsRef = doc(db, 'workspaces', workspaceId)
  const snap = await getDoc(wsRef)
  if (!snap.exists()) throw new Error(`workspace ${workspaceId} not found`)

  const data = snap.data()
  const existingMembers = data['members']
  const hasMembers =
    existingMembers != null &&
    typeof existingMembers === 'object' &&
    Object.keys(existingMembers).length > 0

  const newEntry = { role, addedAt: Timestamp.now() }

  if (hasMembers) {
    await updateDoc(
      wsRef,
      new FieldPath('members', email), newEntry,
      'memberIds', arrayUnion(email),
      'updatedAt', serverTimestamp(),
    )
  } else {
    const ownerId = data['ownerId'] as string
    await updateDoc(wsRef, {
      members: {
        [ownerId]: { role: 'owner', addedAt: Timestamp.now() },
        [email]: newEntry,
      },
      memberIds: [ownerId, email],
      updatedAt: serverTimestamp(),
    })
  }
}

export async function serviceUpdateMemberRole(
  db: Firestore,
  workspaceId: string,
  email: string,
  role: Role,
): Promise<void> {
  await updateDoc(
    doc(db, 'workspaces', workspaceId),
    new FieldPath('members', email, 'role'), role,
    'updatedAt', serverTimestamp(),
  )
}

export async function serviceRemoveMember(
  db: Firestore,
  workspaceId: string,
  email: string,
): Promise<void> {
  await updateDoc(
    doc(db, 'workspaces', workspaceId),
    new FieldPath('members', email), deleteField(),
    'memberIds', arrayRemove(email),
    'updatedAt', serverTimestamp(),
  )
}
