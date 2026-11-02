import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const RESULTS = path.join(ROOT, 'results')
const TRACKER =
  process.env.E2E_TRACKER ??
  'C:/Users/DELL/Unit Testing/School Management System/SMS_Test_Tracker.xlsx'
const read = (file, fallback) =>
  fs.existsSync(path.join(RESULTS, file))
    ? JSON.parse(fs.readFileSync(path.join(RESULTS, file), 'utf8'))
    : fallback

const frontend = read('frontend.json', { results: [] })
const apiAll = read('api.json', { results: [] })
const apiRun = {
  ...apiAll,
  results: apiAll.results.filter((row) => row.module !== 'Telematics service'),
}
const unit = read('unit.json', { testResults: [] })
const bugs = JSON.parse(fs.readFileSync(path.join(ROOT, 'bugs.json'), 'utf8'))
const day = frontend.day ?? apiRun.day ?? ''
const runAt = new Date(frontend.run_at ?? Date.now())

const unitRows = unit.testResults.flatMap((suite) =>
  suite.assertionResults.map((test) => ({
    suite: path.basename(suite.name),
    group: test.ancestorTitles.join(' › '),
    title: test.title,
    status: test.status === 'passed' ? 'Pass' : 'Fail',
    ms: test.duration ?? 0,
  }))
)

let history = []
if (fs.existsSync(TRACKER)) {
  const old = new ExcelJS.Workbook()
  await old.xlsx.readFile(TRACKER)
  const sheet = old.getWorksheet('Run history')
  sheet?.eachRow((row, number) => {
    if (number > 1) history.push(row.values.slice(1))
  })
}

const count = (rows) => ({
  total: rows.length,
  pass: rows.filter((row) => row.status === 'Pass').length,
  fail: rows.filter((row) => row.status !== 'Pass').length,
})
const fe = count(frontend.results)
const be = count(apiRun.results)
const ut = count(unitRows)
const openBugs = bugs.filter((bug) => bug.status !== 'Fixed').length
history.push([
  runAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
  day,
  `${fe.pass}/${fe.total}`,
  `${be.pass}/${be.total}`,
  `${ut.pass}/${ut.total}`,
  bugs.length,
  openBugs,
])
history = history.slice(-200)

const book = new ExcelJS.Workbook()
book.creator = 'Tamilzorous School regression'
book.created = runAt

const GREEN = 'FF159053'
const DEEP = 'FF0D5C35'
const PASS = 'FFE4F2EA'
const FAIL = 'FFFDE2E1'
const border = { style: 'thin', color: { argb: 'FFDBE3DF' } }

function table(sheet, columns, rows) {
  sheet.columns = columns.map(([header, key, width]) => ({ header, key, width }))
  sheet.addRows(rows)
  const header = sheet.getRow(1)
  header.height = 22
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
  sheet.eachRow((row, number) => {
    if (number === 1) return
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = { top: border, bottom: border, left: border, right: border }
    })
    const status = columns.some(([, key]) => key === 'status') ? row.getCell('status') : null
    if (status?.value) {
      const passed = ['Pass', 'Fixed'].includes(String(status.value))
      status.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: passed ? PASS : FAIL } }
      status.font = { bold: true, color: { argb: passed ? DEEP : 'FFB42318' } }
    }
  })
}

const summary = book.addWorksheet('Summary', { properties: { tabColor: { argb: GREEN } } })
summary.columns = [{ width: 28 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }]
summary.addRow(['Tamilzorous School Management System — Test tracker']).font = {
  bold: true,
  size: 16,
  color: { argb: DEEP },
}
summary.addRow([
  `Last run: ${runAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} · ${day}`,
]).font = { color: { argb: 'FF5A6A62' } }
summary.addRow([`Web: ${frontend.base_url ?? ''} · API: ${apiRun.api ?? ''}`]).font = {
  color: { argb: 'FF5A6A62' },
}
summary.addRow([])
const head = summary.addRow(['Suite', 'Total', 'Pass', 'Fail', 'Pass %'])
head.eachCell((cell) => {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
})
for (const [label, numbers] of [
  ['Frontend (browser)', fe],
  ['Backend API', be],
  ['Backend unit tests', ut],
]) {
  const row = summary.addRow([
    label,
    numbers.total,
    numbers.pass,
    numbers.fail,
    numbers.total ? numbers.pass / numbers.total : 0,
  ])
  row.getCell(5).numFmt = '0%'
  row.getCell(4).font = { bold: true, color: { argb: numbers.fail ? 'FFB42318' : DEEP } }
}
summary.addRow([])
summary.addRow(['Bugs logged', bugs.length])
summary.addRow(['Bugs open', openBugs]).getCell(2).font = {
  bold: true,
  color: { argb: openBugs ? 'FFB42318' : DEEP },
}
summary.addRow([])
const moduleHead = summary.addRow(['Module', 'Frontend', 'API', 'Failing'])
moduleHead.eachCell((cell) => {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
})
const modules = [...new Set([...frontend.results, ...apiRun.results].map((row) => row.module))]
for (const name of modules) {
  const f = frontend.results.filter((row) => row.module === name)
  const a = apiRun.results.filter((row) => row.module === name)
  const failing = [...f, ...a].filter((row) => row.status !== 'Pass').length
  const row = summary.addRow([
    name,
    f.length ? `${f.filter((r) => r.status === 'Pass').length}/${f.length}` : '—',
    a.length ? `${a.filter((r) => r.status === 'Pass').length}/${a.length}` : '—',
    failing,
  ])
  row.getCell(4).font = { bold: true, color: { argb: failing ? 'FFB42318' : DEEP } }
}
summary.addRow([])
summary.addRow(['How to run again']).font = { bold: true }
summary.addRow(['1. Start the API (:3000) and the web app (:5173)'])
summary.addRow(['2. In Telamatics_web: npm run test:regression'])
summary.addRow([
  '3. Add new cases to e2e/regression.mjs and e2e/api-regression.mjs; log bugs in e2e/bugs.json',
])

table(
  book.addWorksheet('Frontend tests'),
  [
    ['ID', 'id', 10],
    ['Day', 'day', 8],
    ['Module', 'module', 18],
    ['Type', 'type', 11],
    ['Test case', 'title', 42],
    ['Steps', 'steps', 48],
    ['Expected result', 'expected', 42],
    ['Actual result', 'actual', 42],
    ['Status', 'status', 9],
    ['Time (s)', 'seconds', 9],
    ['Screenshot', 'screenshot', 16],
  ],
  frontend.results.map((row) => ({ ...row, seconds: Math.round(row.ms / 100) / 10 }))
)

table(
  book.addWorksheet('Backend API tests'),
  [
    ['ID', 'id', 12],
    ['Day', 'day', 8],
    ['Module', 'module', 18],
    ['Method', 'method', 9],
    ['Endpoint', 'endpoint', 40],
    ['Scenario', 'scenario', 36],
    ['Expected result', 'expected', 36],
    ['Actual result', 'actual', 44],
    ['Status', 'status', 9],
  ],
  apiRun.results
)

table(
  book.addWorksheet('Backend unit tests'),
  [
    ['Test file', 'suite', 30],
    ['Group', 'group', 34],
    ['Test', 'title', 60],
    ['Status', 'status', 9],
    ['Time (ms)', 'ms', 10],
  ],
  unitRows
)

table(
  book.addWorksheet('Bugs'),
  [
    ['Bug ID', 'id', 10],
    ['Day', 'day', 8],
    ['Found on', 'found', 12],
    ['Module', 'module', 18],
    ['Layer', 'layer', 10],
    ['Severity', 'severity', 10],
    ['Title', 'title', 40],
    ['Steps to reproduce', 'steps', 44],
    ['Expected', 'expected', 34],
    ['Actual (before fix)', 'actual', 34],
    ['Status', 'status', 9],
    ['Fix', 'fix', 44],
    ['Retest', 'retest', 22],
  ],
  bugs
)

table(
  book.addWorksheet('Run history'),
  [
    ['Run at', 'run', 22],
    ['Day', 'day', 8],
    ['Frontend', 'fe', 11],
    ['API', 'api', 11],
    ['Unit', 'unit', 11],
    ['Bugs logged', 'bugs', 12],
    ['Bugs open', 'open', 11],
  ],
  history.map(([run, dayName, feText, apiText, unitText, bugCount, open]) => ({
    run,
    day: dayName,
    fe: feText,
    api: apiText,
    unit: unitText,
    bugs: bugCount,
    open,
  }))
)

fs.mkdirSync(path.dirname(TRACKER), { recursive: true })
await book.xlsx.writeFile(TRACKER)
console.log(`Tracker written: ${TRACKER}`)
console.log(
  `Frontend ${fe.pass}/${fe.total} · API ${be.pass}/${be.total} · Unit ${ut.pass}/${ut.total} · Bugs ${bugs.length} (${openBugs} open)`
)
