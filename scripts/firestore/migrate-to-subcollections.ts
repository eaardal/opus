/**
 * One-time migration: flat workspace documents → subcollections.
 *
 * Before the migration, workspace documents stored projects, people, and teams
 * as top-level arrays. After the migration each of these live as subcollection
 * documents under workspaces/{id}/projects, /people, and /teams respectively.
 * Within each project, tasks and groups become further subcollections.
 *
 * Run with:
 *   cd scripts/firestore && npm install
 *   FIREBASE_PROJECT_ID=domino-staging-dc209 mise run firestore:migrate-to-subcollections
 *
 * Prerequisites:
 *   - GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service-account key
 *     with Firestore read/write on the target project, OR run inside a GCP
 *     environment with default credentials (gcloud auth application-default login).
 *   - FIREBASE_PROJECT_ID set to the target project ID.
 *
 * Safe to re-run: each project/person/team document is written with set()
 * (merge: false), so re-running on already-migrated data is idempotent as long
 * as the source arrays are still present. After verifying the migration remove
 * the legacy arrays from workspace root docs manually or with a follow-up script.
 *
 * Maintenance window required: stop all clients writing to Firestore before
 * running, then deploy the new client code immediately after.
 */

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type DocumentReference } from "firebase-admin/firestore";

// ── Initialise ──────────────────────────────────────────────────────────────

if (getApps().length === 0) initializeApp();
const db = getFirestore();

// ── Legacy shape (pre-migration) ────────────────────────────────────────────

interface LegacyTask {
  id: string;
  text: string;
  x: number;
  y: number;
  category?: string;
  status: string;
  assignedPersonIds?: string[];
}

interface LegacyGroup {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  locked?: boolean;
}

interface LegacyConnection {
  from: string;
  to: string;
}

interface LegacyProject {
  id: string;
  name: string;
  theme?: "dark" | "light";
  taskQueues?: unknown[];
  connections?: LegacyConnection[];
  tasks?: LegacyTask[];
  groups?: LegacyGroup[];
}

interface LegacyPerson {
  id: string;
  name: string;
  picture: string | null;
}

interface LegacyTeam {
  id: string;
  name: string;
  memberIds: string[];
}

interface LegacyWorkspace {
  id: string;
  projects?: LegacyProject[];
  people?: LegacyPerson[];
  teams?: LegacyTeam[];
}

// ── Migration logic ──────────────────────────────────────────────────────────

async function migrateWorkspace(workspaceId: string, data: LegacyWorkspace): Promise<void> {
  const projects = data.projects ?? [];
  const people = data.people ?? [];
  const teams = data.teams ?? [];

  console.log(
    `  workspace ${workspaceId}: ${projects.length} projects, ${people.length} people, ${teams.length} teams`,
  );

  // Firestore limits batch writes to 500 operations. We process one workspace
  // at a time; each project can have many tasks/groups, so we flush and start
  // a new batch whenever we approach the limit.
  let batch = db.batch();
  let opCount = 0;

  const flush = async () => {
    if (opCount > 0) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  };

  const addOp = async (ref: DocumentReference, value: object) => {
    if (opCount >= 450) await flush();
    batch.set(ref, value);
    opCount++;
  };

  // ── Projects ──────────────────────────────────────────────────────────────
  for (const project of projects) {
    const projectRef = db.doc(`workspaces/${workspaceId}/projects/${project.id}`);
    await addOp(projectRef, {
      id: project.id,
      name: project.name,
      theme: project.theme ?? "dark",
      taskQueues: project.taskQueues ?? [],
      connections: project.connections ?? [],
    });

    // ── Tasks ────────────────────────────────────────────────────────────────
    for (const task of project.tasks ?? []) {
      const taskRef = db.doc(
        `workspaces/${workspaceId}/projects/${project.id}/tasks/${task.id}`,
      );
      await addOp(taskRef, {
        id: task.id,
        text: task.text,
        x: task.x,
        y: task.y,
        status: task.status,
        ...(task.category !== undefined && { category: task.category }),
        ...(task.assignedPersonIds !== undefined && {
          assignedPersonIds: task.assignedPersonIds,
        }),
      });
    }

    // ── Groups ───────────────────────────────────────────────────────────────
    for (const group of project.groups ?? []) {
      const groupRef = db.doc(
        `workspaces/${workspaceId}/projects/${project.id}/groups/${group.id}`,
      );
      await addOp(groupRef, {
        id: group.id,
        title: group.title,
        x: group.x,
        y: group.y,
        width: group.width,
        height: group.height,
        ...(group.locked !== undefined && { locked: group.locked }),
      });
    }
  }

  // ── People ────────────────────────────────────────────────────────────────
  for (const person of people) {
    const personRef = db.doc(`workspaces/${workspaceId}/people/${person.id}`);
    await addOp(personRef, {
      id: person.id,
      name: person.name,
      picture: person.picture,
    });
  }

  // ── Teams ─────────────────────────────────────────────────────────────────
  for (const team of teams) {
    const teamRef = db.doc(`workspaces/${workspaceId}/teams/${team.id}`);
    await addOp(teamRef, {
      id: team.id,
      name: team.name,
      memberIds: team.memberIds,
    });
  }

  await flush();
}

async function run(): Promise<void> {
  console.log("Starting migration: flat workspace arrays → subcollections");

  const snapshot = await db.collection("workspaces").get();
  console.log(`Found ${snapshot.docs.length} workspace(s)`);

  for (const doc of snapshot.docs) {
    const data = doc.data() as LegacyWorkspace;

    const hasLegacyData =
      Array.isArray(data.projects) || Array.isArray(data.people) || Array.isArray(data.teams);

    if (!hasLegacyData) {
      console.log(`  workspace ${doc.id}: no legacy arrays, skipping`);
      continue;
    }

    try {
      await migrateWorkspace(doc.id, { id: doc.id, ...data });
      console.log(`  workspace ${doc.id}: migrated successfully`);
    } catch (err) {
      console.error(`  workspace ${doc.id}: FAILED —`, err);
      // Continue with other workspaces rather than aborting the entire run.
    }
  }

  console.log("Migration complete.");
  console.log(
    "Next steps:\n" +
      "  1. Verify subcollection data in the Firebase console\n" +
      "  2. Deploy the new client code\n" +
      "  3. After confirming all clients are updated, remove the legacy\n" +
      "     projects/people/teams arrays from workspace root documents",
  );
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
