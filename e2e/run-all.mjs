import { spawnSync } from 'node:child_process'
import path from 'node:path'

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const BACKEND = process.env.E2E_BACKEND_DIR ?? 'C:/Users/DELL/Telematics'
const SERVICE = process.env.E2E_SERVICE_DIR ?? 'C:/Users/DELL/telematics-service'
const run = (label, command, args, cwd) => {
  console.log(`\n=== ${label} ===`)
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  return result.status === 0
}

const api = run('Backend API checks', 'node', ['e2e/api-regression.mjs'], path.dirname(ROOT))
const web = run('Frontend browser checks', 'node', ['e2e/regression.mjs'], path.dirname(ROOT))
const unit = run(
  'Backend unit tests',
  'npx',
  ['jest', '--json', `--outputFile=${path.join(ROOT, 'results', 'unit.json')}`],
  BACKEND
)
const service = run(
  'Telematics service unit tests',
  'npx',
  ['jest', '--json', `--outputFile=${path.join(ROOT, 'results', 'telematics-unit.json')}`],
  SERVICE
)
run('Remove test data', 'node', ['e2e/cleanup-test-data.mjs'], path.dirname(ROOT))
run(
  'Excel tracker: School Management System',
  'node',
  ['e2e/build-tracker.mjs'],
  path.dirname(ROOT)
)
run(
  'Excel tracker: Telematics Service',
  'node',
  ['e2e/build-service-tracker.mjs'],
  path.dirname(ROOT)
)
console.log(
  `\nAPI ${api ? 'passed' : 'has failures'} · Frontend ${web ? 'passed' : 'has failures'} · Unit ${unit ? 'passed' : 'has failures'} · Telematics ${service ? 'passed' : 'has failures'}`
)
process.exit(api && web && unit && service ? 0 : 1)
