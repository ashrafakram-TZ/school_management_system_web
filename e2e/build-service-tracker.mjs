import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const RESULTS = path.join(ROOT, 'results')
const TRACKER =
  process.env.E2E_SERVICE_TRACKER ??
  'C:/Users/DELL/Unit Testing/Telematics Service/Telematics_Service_Test_Tracker.xlsx'
const read = (file, fallback) =>
  fs.existsSync(path.join(RESULTS, file))
    ? JSON.parse(fs.readFileSync(path.join(RESULTS, file), 'utf8'))
    : fallback

const unit = read('telematics-unit.json', { testResults: [] })
const apiAll = read('api.json', { results: [], day: '' })
const apiRows = apiAll.results.filter((row) => row.module === 'Telematics service')
const runAt = new Date()

const unitRows = unit.testResults.flatMap((suite) =>
  suite.assertionResults.map((test) => ({
    suite: path.basename(suite.name),
    group: test.ancestorTitles.join(' › '),
    title: test.title,
    status: test.status === 'passed' ? 'Pass' : 'Fail',
    ms: test.duration ?? 0,
  }))
)
const count = (rows) => ({
  total: rows.length,
  pass: rows.filter((row) => row.status === 'Pass').length,
})
const ut = count(unitRows)
const at = count(apiRows)

let history = []
if (fs.existsSync(TRACKER)) {
  const old = new ExcelJS.Workbook()
  await old.xlsx.readFile(TRACKER)
  old.getWorksheet('Run history')?.eachRow((row, number) => {
    if (number > 1) history.push(row.values.slice(1))
  })
}
history.push([
  runAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
  apiAll.day ?? '',
  `${ut.pass}/${ut.total}`,
  `${at.pass}/${at.total}`,
])
history = history.slice(-200)

const GREEN = 'FF159053'
const DEEP = 'FF0D5C35'
const border = { style: 'thin', color: { argb: 'FFDBE3DF' } }
const book = new ExcelJS.Workbook()
book.creator = 'Tamilzorous regression'

function table(sheet, columns, rows) {
  sheet.columns = columns.map(([header, key, width]) => ({ header, key, width }))
  sheet.addRows(rows)
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
  })
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
  const hasStatus = columns.some(([, key]) => key === 'status')
  sheet.eachRow((row, number) => {
    if (number === 1) return
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = { top: border, bottom: border, left: border, right: border }
    })
    if (!hasStatus) return
    const status = row.getCell('status')
    const passed = status.value === 'Pass'
    status.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: passed ? 'FFE4F2EA' : 'FFFDE2E1' },
    }
    status.font = { bold: true, color: { argb: passed ? DEEP : 'FFB42318' } }
  })
}

const summary = book.addWorksheet('Summary', { properties: { tabColor: { argb: GREEN } } })
summary.columns = [{ width: 30 }, { width: 12 }, { width: 12 }, { width: 12 }]
summary.addRow(['Telematics Service — Test tracker']).font = {
  bold: true,
  size: 16,
  color: { argb: DEEP },
}
summary.addRow([`Last run: ${runAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`])
summary.addRow(['Project: C:/Users/DELL/telematics-service · Swagger :3001/api/docs'])
summary.addRow([])
const head = summary.addRow(['Suite', 'Total', 'Pass', 'Fail'])
head.eachCell((cell) => {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
})
summary.addRow(['Unit tests', ut.total, ut.pass, ut.total - ut.pass])
summary.addRow(['API checks (from the School regression)', at.total, at.pass, at.total - at.pass])

table(
  book.addWorksheet('Unit tests'),
  [
    ['Test file', 'suite', 30],
    ['Group', 'group', 30],
    ['Test', 'title', 60],
    ['Status', 'status', 9],
    ['Time (ms)', 'ms', 10],
  ],
  unitRows
)
table(
  book.addWorksheet('API checks'),
  [
    ['ID', 'id', 12],
    ['Method', 'method', 9],
    ['Endpoint', 'endpoint', 34],
    ['Scenario', 'scenario', 30],
    ['Expected result', 'expected', 30],
    ['Actual result', 'actual', 34],
    ['Status', 'status', 9],
  ],
  apiRows
)
table(
  book.addWorksheet('Run history'),
  [
    ['Run at', 'run', 22],
    ['Day', 'day', 8],
    ['Unit', 'unit', 10],
    ['API', 'api', 10],
  ],
  history.map(([run, day, unitText, apiText]) => ({ run, day, unit: unitText, api: apiText }))
)

fs.mkdirSync(path.dirname(TRACKER), { recursive: true })
await book.xlsx.writeFile(TRACKER)
console.log(`Tracker written: ${TRACKER}`)
console.log(`Unit ${ut.pass}/${ut.total} · API ${at.pass}/${at.total}`)
