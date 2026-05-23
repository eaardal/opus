/**
 * migrate-users-to-email-keys.ts
 *
 * Migrates user document IDs from Firebase Auth UIDs to email addresses,
 * and updates all workspace documents that reference those UIDs in their
 * ownerId, members map, and memberIds array.
 *
 * Why: Firebase Auth assigns project-scoped UIDs. The same Google account
 * gets different UIDs in different Firebase projects. Using email as the
 * document key makes identities stable and portable across projects.
 *
 * SAFE TO RE-RUN: documents already using an email as their ID are skipped.
 *
 * Setup:
 *   cd scripts/firestore
 *   npm install
 *
 * Run against staging:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/staging-service-account.json \
 *   FIREBASE_PROJECT_ID=domino-staging-dc209 \
 *   npm run migrate-users-to-email-keys
 *
 * Run against production:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/prod-service-account.json \
 *   FIREBASE_PROJECT_ID=domino-34fce \
 *   npm run migrate-users-to-email-keys
 *
 * Alternatively, if you have application default credentials set up via
 * `gcloud auth application-default login`, omit GOOGLE_APPLICATION_CREDENTIALS
 * and just set FIREBASE_PROJECT_ID.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ── Init ─────────────────────────────────────────────────────────────────────

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error("Error: FIREBASE_PROJECT_ID environment variable is required.");
  process.exit(1);
}

if (!getApps().length) {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    const { default: serviceAccount } = await import(credPath, { assert: { type: "json" } });
    initializeApp({ credential: cert(serviceAccount), projectId });
  } else {
    // Falls back to application default credentials (gcloud auth application-default login)
    initializeApp({ projectId });
  }
}

const db = getFirestore();

// ── Helpers ──────────────────────────────────────────────────────────────────

function isEmail(value: string): boolean {
  return value.includes("@");
}

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ── Step 1: Migrate users collection ─────────────────────────────────────────

async function migrateUsers(): Promise<Map<string, string>> {
  log("=== Step 1/2  Migrating users collection ===");

  const snap = await db.collection("users").get();
  const uidToEmail = new Map<string, string>();
  let migrated = 0;
  let skipped = 0;

  for (const docSnap of snap.docs) {
    const oldId = docSnap.id;
    const data = docSnap.data();
    const email: string | undefined = data.email;

    if (!email) {
      log(`  WARN  users/${oldId} has no email field — skipping`);
      skipped++;
      continue;
    }

    if (isEmail(oldId)) {
      // Already migrated or already keyed by email.
      log(`  SKIP  users/${oldId} — already an email key`);
      uidToEmail.set(oldId, oldId);
      skipped++;
      continue;
    }

    // oldId is a Firebase UID — rename to email.
    const newDocRef = db.collection("users").doc(email);
    const newData = {
      email,
      displayName: data.displayName ?? null,
      photoURL: data.photoURL ?? null,
      firebaseUid: oldId, // keep old UID for reference
      updatedAt: data.updatedAt ?? FieldValue.serverTimestamp(),
    };

    log(`  MIGRATE  users/${oldId}  →  users/${email}`);
    await newDocRef.set(newData);
    await docSnap.ref.delete();

    uidToEmail.set(oldId, email);
    migrated++;
  }

  log(`  Done: ${migrated} migrated, ${skipped} skipped.\n`);
  return uidToEmail;
}

// ── Step 2: Update workspace documents ───────────────────────────────────────

async function migrateWorkspaces(uidToEmail: Map<string, string>): Promise<void> {
  log("=== Step 2/2  Updating workspace documents ===");

  const snap = await db.collection("workspaces").get();
  let updated = 0;
  let skipped = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const updates: Record<string, unknown> = {};
    let needsUpdate = false;

    // ownerId
    const ownerId: string | undefined = data.ownerId;
    if (ownerId && !isEmail(ownerId)) {
      const ownerEmail = uidToEmail.get(ownerId);
      if (ownerEmail) {
        updates.ownerId = ownerEmail;
        needsUpdate = true;
      } else {
        log(`  WARN  workspaces/${docSnap.id} — ownerId "${ownerId}" not found in user map`);
      }
    }

    // members map
    const members: Record<string, unknown> | undefined = data.members;
    if (members) {
      const newMembers: Record<string, unknown> = {};
      let membersChanged = false;
      for (const [key, value] of Object.entries(members)) {
        if (!isEmail(key)) {
          const email = uidToEmail.get(key);
          if (email) {
            newMembers[email] = value;
            membersChanged = true;
          } else {
            log(`  WARN  workspaces/${docSnap.id} — member uid "${key}" not found in user map`);
            newMembers[key] = value; // keep as-is to avoid data loss
          }
        } else {
          newMembers[key] = value; // already an email
        }
      }
      if (membersChanged) {
        updates.members = newMembers;
        needsUpdate = true;
      }
    }

    // memberIds array
    const memberIds: string[] | undefined = data.memberIds;
    if (Array.isArray(memberIds)) {
      let idsChanged = false;
      const newMemberIds = memberIds.map((id) => {
        if (!isEmail(id)) {
          const email = uidToEmail.get(id);
          if (email) {
            idsChanged = true;
            return email;
          }
          log(`  WARN  workspaces/${docSnap.id} — memberIds entry "${id}" not found in user map`);
        }
        return id;
      });
      if (idsChanged) {
        updates.memberIds = newMemberIds;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      log(`  UPDATE  workspaces/${docSnap.id}`);
      await docSnap.ref.update(updates);
      updated++;
    } else {
      skipped++;
    }
  }

  log(`  Done: ${updated} updated, ${skipped} skipped.\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

log(`Starting migration on project: ${projectId}`);
log("This is safe to re-run — already-migrated documents are skipped.\n");

const uidToEmail = await migrateUsers();
await migrateWorkspaces(uidToEmail);

log("Migration complete.");
