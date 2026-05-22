import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const RULES_PATH = resolve(__dirname, '../../firestore.rules')
const EMULATOR_HOST = 'localhost'
const EMULATOR_PORT = 8080

// Each call gets a unique project ID so test files running in parallel never
// share an emulator namespace or a Firebase app instance.
function uniqueProjectId(): string {
  return `domino-test-${Date.now()}-${Math.floor(Math.random() * 100_000)}`
}

export function createTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: uniqueProjectId(),
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: EMULATOR_HOST,
      port: EMULATOR_PORT,
    },
  })
}
