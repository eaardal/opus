/**
 * rename-integration-category-to-milestone.ts
 *
 * Renames the stored task category key "integration" → "milestone" across every
 * task document. The "Integration Point" category was renamed to "Milestone";
 * the display label changes in code, but tasks persist the category *key*, so
 * existing documents still carry the old `category: "integration"` value.
 *
 * The client build ships a read-time alias (resolveCategoryKey) that renders
 * legacy `integration` tasks as Milestone immediately, so this migration is not
 * urgent — it is the definitive flush that lets the alias be removed later.
 *
 * Tasks live at:  workspaces/{wsId}/projects/{projId}/tasks/{taskId}
 * so this scans the `tasks` collection group across all workspaces/projects.
 *
 * SAFE TO RE-RUN: documents already storing "milestone" are not matched, so a
 * second run updates nothing.
 *
 * DRY RUN: set DRY_RUN=1 to report what would change without writing.
 *
 * Setup:
 *   cd scripts/firestore
 *   npm install
 *
 * Run against staging:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/staging-service-account.json \
 *   FIREBASE_PROJECT_ID=domino-staging-dc209 \
 *   npm run rename-integration-category-to-milestone
 *
 * Run against production:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/prod-service-account.json \
 *   FIREBASE_PROJECT_ID=domino-34fce \
 *   npm run rename-integration-category-to-milestone
 *
 * Alternatively, with application default credentials set up via
 * `gcloud auth application-default login`, omit GOOGLE_APPLICATION_CREDENTIALS
 * and just set FIREBASE_PROJECT_ID.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

// ── Constants ──────────────────────────────────────────────────────────────────

const LEGACY_CATEGORY = "integration";
const NEW_CATEGORY = "milestone";
// Firestore caps a batch at 500 writes; flush below that to leave headroom.
const BATCH_FLUSH_AT = 450;
const DRY_RUN = process.env.DRY_RUN === "1";

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ── Migration ──────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  log(
    `=== Rename task category "${LEGACY_CATEGORY}" → "${NEW_CATEGORY}"${DRY_RUN ? " (DRY RUN)" : ""} ===`,
  );

  // An unfiltered collection-group read needs no composite index and returns
  // every task across all workspaces/projects. We filter in memory so the
  // script has no index prerequisites.
  const snap = await db.collectionGroup("tasks").get();
  const toMigrate = snap.docs.filter((doc) => doc.get("category") === LEGACY_CATEGORY);

  log(`Scanned ${snap.size} task(s); ${toMigrate.length} still on "${LEGACY_CATEGORY}".`);

  if (toMigrate.length === 0) {
    log("Nothing to migrate. Done.");
    return;
  }

  if (DRY_RUN) {
    for (const doc of toMigrate) log(`  would update ${doc.ref.path}`);
    log(`DRY RUN complete: ${toMigrate.length} document(s) would be updated.`);
    return;
  }

  let batch = db.batch();
  let opCount = 0;
  let migrated = 0;

  const flush = async () => {
    if (opCount > 0) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  };

  for (const doc of toMigrate) {
    if (opCount >= BATCH_FLUSH_AT) await flush();
    batch.update(doc.ref, { category: NEW_CATEGORY });
    opCount++;
    migrated++;
  }
  await flush();

  log(`Updated ${migrated} document(s) to "${NEW_CATEGORY}".`);
  log("Verify 0 remaining with: DRY_RUN=1 npm run rename-integration-category-to-milestone");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
