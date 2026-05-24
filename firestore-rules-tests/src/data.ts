// User identity in this codebase is the email address — it is the document ID
// for /users/{userEmail}, the value stored in workspace.ownerId, the keys
// inside workspace.members, and the values inside workspace.memberIds.
// Firebase Auth UID is not consulted by the rules; tests pass the email as
// the auth UID too, since rules only read request.auth.token.email.

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

export const OWNER_EMAIL = ALLOWED_EMAILS.tv2
export const EDITOR_EMAIL = ALLOWED_EMAILS.apparat
export const OUTSIDER_EMAIL = ALLOWED_EMAILS.gmail

export function makeUserDoc(email: string): Record<string, unknown> {
  return { email, displayName: 'Test User' }
}

export function makeWorkspaceDoc(
  ownerEmail: string,
  editorEmail?: string
): Record<string, unknown> {
  const memberIds = [ownerEmail, ...(editorEmail ? [editorEmail] : [])]
  const members: Record<string, { role: string }> = {
    [ownerEmail]: { role: 'owner' },
    ...(editorEmail ? { [editorEmail]: { role: 'editor' } } : {}),
  }
  return {
    ownerId: ownerEmail,
    memberIds,
    members,
    name: 'Test Workspace',
    updatedAt: new Date(),
  }
}

// Pre-roles workspace: only ownerId, no memberIds/members map.
export function makeLegacyWorkspaceDoc(ownerEmail: string): Record<string, unknown> {
  return {
    ownerId: ownerEmail,
    name: 'Legacy Workspace',
    updatedAt: new Date(),
  }
}
