export const OWNER_UID = 'owner-uid'
export const EDITOR_UID = 'editor-uid'
export const OUTSIDER_UID = 'outsider-uid'
export const WORKSPACE_ID = 'workspace-id'

export const ALLOWED_EMAILS = {
  gmail: 'eirikaardal@gmail.com',
  tv2: 'user@tv2.no',
  apparat: 'user@apparat.no',
} as const

export const DENIED_EMAILS = {
  other: 'user@other.com',
  otherGmail: 'notallowed@gmail.com',
} as const

export function makeUserDoc(uid: string, email: string): Record<string, unknown> {
  return { uid, email, displayName: 'Test User' }
}

export function makeWorkspaceDoc(
  ownerUid: string,
  editorUid?: string
): Record<string, unknown> {
  const memberIds = [ownerUid, ...(editorUid ? [editorUid] : [])]
  const members: Record<string, { role: string }> = {
    [ownerUid]: { role: 'owner' },
    ...(editorUid ? { [editorUid]: { role: 'editor' } } : {}),
  }
  return {
    ownerId: ownerUid,
    memberIds,
    members,
    name: 'Test Workspace',
    projects: [],
    people: [],
    teams: [],
    updatedAt: new Date(),
  }
}

// Pre-roles workspace: only ownerId, no memberIds/members map.
export function makeLegacyWorkspaceDoc(ownerUid: string): Record<string, unknown> {
  return {
    ownerId: ownerUid,
    name: 'Legacy Workspace',
    projects: [],
    people: [],
    teams: [],
    updatedAt: new Date(),
  }
}
