import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { chromium } from 'playwright-core'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const CHROME = process.env.E2E_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const DAY = process.env.E2E_DAY ?? 'Day 4'
const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const OUT = path.join(ROOT, 'results')
const SHOTS = path.join(OUT, 'screenshots')
fs.mkdirSync(SHOTS, { recursive: true })

const RUN = String(Date.now()).slice(-5)
const mobile = (n) => `98${RUN}${String(n).padStart(3, '0')}`
const results = []
const created = { students: [], users: [], staff: [], subjects: [], holidays: [], admissions: [] }

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: process.env.E2E_HEADED !== '1',
})

async function signedInContext(mobileNumber, stateFile, viewport = { width: 1440, height: 900 }) {
  const file = path.join(ROOT, stateFile)
  const context = await browser.newContext({
    viewport,
    ...(fs.existsSync(file) ? { storageState: file } : {}),
  })
  const page = await context.newPage()
  await page.goto(`${BASE}/`)
  await page.waitForTimeout(1500)
  if (page.url().includes('/login')) {
    await page.getByLabel(/mobile/i).fill(mobileNumber)
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await page.getByRole('button', { name: /continue with otp/i }).click()
      const ok = await page
        .getByText('Enter the code')
        .waitFor({ timeout: 6000 })
        .then(() => true)
        .catch(() => false)
      if (ok) break
      await page.waitForTimeout(32000)
    }
    await page.keyboard.type('123456')
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 })
    await context.storageState({ path: file })
  }
  return { context, page }
}

const admin = await signedInContext('9876543210', '.auth-admin.json')
let page = admin.page

async function test(meta, fn) {
  const started = Date.now()
  const row = { day: DAY, ...meta, status: 'Pass', actual: meta.expected, screenshot: '', ms: 0 }
  try {
    await fn()
  } catch (error) {
    row.status = 'Fail'
    row.actual = String(error?.message ?? error)
      .split('\n')[0]
      .slice(0, 300)
    row.screenshot = `${meta.id}.png`
    await page
      .screenshot({ path: path.join(SHOTS, row.screenshot), fullPage: true })
      .catch(() => null)
  }
  row.ms = Date.now() - started
  results.push(row)
  console.log(
    `${row.status === 'Pass' ? 'PASS' : 'FAIL'}  ${meta.id.padEnd(8)} ${meta.title}${row.status === 'Fail' ? `\n        ${row.actual}` : ''}`
  )
  for (
    let i = 0;
    i < 3 && (row.status === 'Fail' || !meta.keepOpen) && (await page.getByRole('dialog').count());
    i += 1
  ) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
  }
}

const dialog = () => page.getByRole('dialog').last()
const go = async (url) => {
  await page.goto(`${BASE}${url}`)
  await page.waitForLoadState('networkidle').catch(() => null)
}
const see = async (text, scope = page, timeout = 8000) => {
  await scope.getByText(text).locator('visible=true').first().waitFor({ state: 'visible', timeout })
}
const fill = async (scope, label, value) => {
  const field = scope.getByLabel(label).first()
  await field.fill(value)
}
const pick = async (scope, name, option) => {
  await scope.getByRole('combobox', { name }).first().click()
  await page.getByRole('option', { name: option }).first().click()
}
const click = async (scope, name) => {
  await scope.getByRole('button', { name }).first().click()
}
const api = async (method, url, body) => {
  const session = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('tz-session') ?? 'null')
  )
  const response = await fetch(`${BASE}/api/v1${url}`, {
    method,
    headers: { authorization: `Bearer ${session.accessToken}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return response.json()
}

const samplePdf = path.join(OUT, 'sample.pdf')
fs.writeFileSync(
  samplePdf,
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'
)

{
  const guest = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const previous = page
  page = await guest.newPage()
  await test(
    {
      id: 'LG-01',
      module: 'Login',
      type: 'Validation',
      title: 'Continue button stays off until a 10-digit mobile is entered',
      steps: 'Open /login. Type 12345 in the mobile box.',
      expected: 'Continue with OTP is disabled',
    },
    async () => {
      await go('/login')
      await page.getByLabel(/mobile/i).fill('12345')
      if (!(await page.getByRole('button', { name: /continue with otp/i }).isDisabled()))
        throw new Error('Button is enabled')
    }
  )
  await test(
    {
      id: 'LG-02',
      module: 'Login',
      type: 'Validation',
      title: 'Unregistered mobile shows a clear error',
      steps: 'Enter 9123400000 and press Continue with OTP.',
      expected: 'Red box "Number not registered"',
    },
    async () => {
      await page.getByLabel(/mobile/i).fill('9123400000')
      await click(page, /continue with otp/i)
      await see('Number not registered')
    }
  )
  await test(
    {
      id: 'LG-03',
      module: 'Login',
      type: 'Validation',
      title: 'Wrong OTP shows "Wrong code"',
      steps: 'Enter 9000000002, continue, type 000000.',
      expected: 'Red box "Wrong code" and the boxes clear',
    },
    async () => {
      await go('/login')
      await page.getByLabel(/mobile/i).fill('9000000002')
      await click(page, /continue with otp/i)
      await see('Enter the code')
      await page.keyboard.type('000000')
      await see(/Wrong code|Too many attempts/)
    }
  )
  await test(
    {
      id: 'LG-04',
      module: 'Login',
      type: 'View',
      title: 'Sign-in page fits a phone screen without sideways scroll',
      steps: 'Open /login at 390 x 844.',
      expected: 'Page width equals screen width',
    },
    async () => {
      await page.setViewportSize({ width: 390, height: 844 })
      await go('/login')
      const width = await page.evaluate(() => document.documentElement.scrollWidth)
      if (width > 391) throw new Error(`Page is ${width}px wide`)
    }
  )
  await guest.close()
  page = previous
}

await test(
  {
    id: 'LG-05',
    module: 'Login',
    type: 'Add',
    title: 'Admin signs in with OTP and reaches the dashboard',
    steps: 'Sign in as 9876543210 with 123456.',
    expected: 'Dashboard opens with the sidebar',
  },
  async () => {
    await go('/')
    if (page.url().includes('/login')) throw new Error('Still on login')
    await page.getByRole('navigation').first().waitFor()
  }
)

await test(
  {
    id: 'US-01',
    module: 'Users',
    type: 'Validation',
    title: 'Add user with nothing filled shows required messages',
    steps: 'Users → Add user → Add user.',
    expected:
      'Enter the full name · Enter a valid 10-digit mobile number · Choose at least one role',
  },
  async () => {
    await go('/users')
    await click(page, /^add user/i)
    await click(dialog(), /^add user$/i)
    await see('Enter the full name', dialog())
    await see('Enter a valid 10-digit mobile number', dialog())
    await see('Choose at least one role', dialog())
  }
)
await test(
  {
    id: 'US-02',
    module: 'Users',
    type: 'Validation',
    title: 'Wrong mobile and email formats are caught',
    steps: 'Mobile 12345, email abc.',
    expected: 'Mobile and email messages show',
  },
  async () => {
    await click(page, /^add user/i)
    await fill(dialog(), /^Mobile number/, '12345')
    await fill(dialog(), /^Email/, 'abc')
    await click(dialog(), /^add user$/i)
    await see('Enter a valid 10-digit mobile number', dialog())
    await see('Enter a valid email address', dialog())
  }
)
await test(
  {
    id: 'US-03',
    module: 'Users',
    type: 'Add',
    title: 'Add a teacher user',
    steps: `Name RT User ${RUN}, mobile ${mobile(1)}, role Teacher, save.`,
    expected: 'User appears in the list',
  },
  async () => {
    await click(page, /^add user/i)
    await fill(dialog(), /^Full name/, `RT User ${RUN}`)
    await fill(dialog(), /^Mobile number/, mobile(1))
    await dialog().getByText('Teacher', { exact: true }).click()
    await click(dialog(), /^add user$/i)
    await dialog().waitFor({ state: 'detached', timeout: 8000 })
    await page.getByRole('searchbox').first().fill(`RT User ${RUN}`)
    await see(`RT User ${RUN}`)
    const list = await api('GET', `/admin/users?search=${mobile(1)}`)
    created.users.push(...list.data.items.map((item) => item.id))
  }
)
await test(
  {
    id: 'US-04',
    module: 'Users',
    type: 'Validation',
    title: 'Same mobile twice is refused',
    steps: `Add another user with ${mobile(1)}.`,
    expected: 'Message that the mobile already exists',
  },
  async () => {
    await click(page, /^add user/i)
    await fill(dialog(), /^Full name/, 'RT Duplicate')
    await fill(dialog(), /^Mobile number/, mobile(1))
    await dialog().getByText('Teacher', { exact: true }).click()
    await click(dialog(), /^add user$/i)
    await see(/already exists/i, page)
  }
)

await test(
  {
    id: 'SU-01',
    module: 'School setup',
    type: 'Validation',
    title: 'Add subject with nothing filled',
    steps: 'School setup → Subjects → Add subject → Add subject.',
    expected: 'Enter the subject name · code rule message',
  },
  async () => {
    await go('/setup?tab=subjects')
    await click(page, /^add subject/i)
    await click(dialog(), /^add subject$/i)
    await see('Enter the subject name', dialog())
    await see(/2 to 20 letters/, dialog())
  }
)
await test(
  {
    id: 'SU-02',
    module: 'School setup',
    type: 'Add',
    title: 'Add a subject',
    steps: `Name RT Subject ${RUN}, code RT${RUN}.`,
    expected: 'Subject shows in the list',
  },
  async () => {
    await click(page, /^add subject/i)
    await fill(dialog(), /^Name/, `RT Subject ${RUN}`)
    await fill(dialog(), /^Code/, `RT${RUN}`)
    await click(dialog(), /^add subject$/i)
    await dialog().waitFor({ state: 'detached', timeout: 8000 })
    await see(`RT Subject ${RUN}`)
    const list = await api('GET', `/admin/subjects?search=RT${RUN}`)
    created.subjects.push(...list.data.items.map((item) => item.id))
  }
)
await test(
  {
    id: 'SU-03',
    module: 'School setup',
    type: 'Validation',
    title: 'Duplicate subject code is refused',
    steps: `Add another subject with code RT${RUN}.`,
    expected: 'Message that the code is already used',
  },
  async () => {
    await click(page, /^add subject/i)
    await fill(dialog(), /^Name/, 'RT Duplicate')
    await fill(dialog(), /^Code/, `RT${RUN}`)
    await click(dialog(), /^add subject$/i)
    await see(/already|used|exists/i, dialog())
  }
)
await test(
  {
    id: 'SU-04',
    keepOpen: true,
    module: 'School setup',
    type: 'Validation',
    title: 'Add holiday with nothing filled, then last day before first day',
    steps: 'Holidays → Add holiday → Add. Then date 2026-12-10, last day 2026-12-05.',
    expected: 'Enter a name · Choose the date · Must be on or after the first day',
  },
  async () => {
    await go('/setup?tab=holidays')
    await click(page, /^add holiday/i)
    await click(dialog(), /^add$/i)
    await see('Enter a name', dialog())
    await see('Choose the date', dialog())
    await fill(dialog(), /^Name/, `RT Holiday ${RUN}`)
    await fill(dialog(), /^Date/, '2026-12-10')
    await fill(dialog(), /^Last day/, '2026-12-05')
    await click(dialog(), /^add$/i)
    await see('Must be on or after the first day', dialog())
  }
)
await test(
  {
    id: 'SU-05',
    module: 'School setup',
    type: 'Add',
    title: 'Add a holiday',
    steps: `RT Holiday ${RUN} on 2026-12-10.`,
    expected: 'Holiday shows in the list',
  },
  async () => {
    await fill(dialog(), /^Last day/, '')
    await click(dialog(), /^add$/i)
    await dialog().waitFor({ state: 'detached', timeout: 8000 })
    await see(`RT Holiday ${RUN}`)
    const list = await api('GET', '/admin/holidays')
    created.holidays.push(
      ...list.data.filter((item) => item.name === `RT Holiday ${RUN}`).map((item) => item.id)
    )
  }
)

let studentUrl = ''
await test(
  {
    id: 'ST-01',
    module: 'Students',
    type: 'Validation',
    title: 'Add student with nothing filled shows every required message',
    steps: 'Students → Add student → Add student.',
    expected:
      'Enter the first name · Enter the date of birth · Choose a gender · Choose a class · Enter the full name · Enter a valid 10-digit mobile',
  },
  async () => {
    await go('/students')
    await click(page, /^add student/i)
    await click(dialog(), /^add student$/i)
    for (const text of [
      'Enter the first name',
      'Enter the date of birth',
      'Choose a gender',
      'Choose a class',
      'Enter the full name',
      'Enter a valid 10-digit mobile',
    ]) {
      await see(text, dialog())
    }
  }
)
await test(
  {
    id: 'ST-02',
    module: 'Students',
    type: 'Add',
    title: 'Add a student with a father',
    steps: `RT Kid ${RUN}, born 2016-05-10, boy, class 5, father RT Father ${RUN} ${mobile(2)}.`,
    expected: 'Student profile opens',
  },
  async () => {
    await go('/students')
    await click(page, /^add student/i)
    const form = dialog()
    await fill(form, /^First name/, 'RTKid')
    await fill(form, /^Last name/, RUN)
    await fill(form, /^Date of birth/, '2016-05-10')
    await pick(form, 'Gender', 'Boy')
    await pick(form, 'Class', 'Class 5')
    await form
      .getByRole('group')
      .getByLabel(/^Full name/)
      .fill(`RT Father ${RUN}`)
    await form
      .getByRole('group')
      .getByLabel(/^Mobile/)
      .fill(mobile(2))
    await form.getByRole('switch').last().click()
    await click(form, /^add student$/i)
    await page.waitForURL(/\/students\/\d+/, { timeout: 10000 })
    await see(`RTKid ${RUN}`)
    studentUrl = new URL(page.url()).pathname
    created.students.push(Number(studentUrl.split('/').pop()))
  }
)
await test(
  {
    id: 'ST-03',
    module: 'Students',
    type: 'View',
    title: 'Every profile tab opens',
    steps: 'Open Profile, Parents, Documents, Health, Behaviour, Transport tabs.',
    expected: 'Each tab shows its content',
  },
  async () => {
    if (!studentUrl) throw new Error('No student from ST-02')
    const checks = [
      ['Profile', 'Class history'],
      ['Parents', 'Parents and guardians'],
      ['Documents', /No documents yet|documents?/],
      ['Health', 'Vaccinations'],
      ['Behaviour', /No notes yet|Add note/],
      ['Transport', 'No bus stop yet'],
    ]
    for (const [tab, text] of checks) {
      await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click()
      await see(text)
    }
  }
)
await test(
  {
    id: 'ST-04',
    keepOpen: true,
    module: 'Students',
    type: 'Validation',
    title: 'Edit student: empty first name and short pincode',
    steps: 'Edit → clear first name, pincode 12 → Save.',
    expected: 'Enter the first name · Pincode has 6 digits',
  },
  async () => {
    await go(studentUrl)
    await click(page, /^edit$/i)
    await fill(dialog(), /^First name/, '')
    await fill(dialog(), /^Pincode/, '12')
    await click(dialog(), /^save$/i)
    await see('Enter the first name', dialog())
    await see('Pincode has 6 digits', dialog())
  }
)
await test(
  {
    id: 'ST-05',
    module: 'Students',
    type: 'Add',
    title: 'Edit student details',
    steps: 'First name RTKid, pincode 600040, city Chennai → Save.',
    expected: '"Details saved" and the address updates',
  },
  async () => {
    await fill(dialog(), /^First name/, 'RTKid')
    await fill(dialog(), /^Pincode/, '600040')
    await fill(dialog(), /^City/, 'Chennai')
    await click(dialog(), /^save$/i)
    await see('Details saved')
    await see(/Chennai, 600040/)
  }
)
await test(
  {
    id: 'ST-06',
    keepOpen: true,
    module: 'Student health',
    type: 'Validation',
    title: 'Health record rejects impossible height and bad doctor mobile',
    steps: 'Health → Add → height 999, doctor mobile 123 → Save.',
    expected: 'Height in cm, 30 to 250 · Enter a valid 10-digit mobile',
  },
  async () => {
    await go(`${studentUrl}?tab=health`)
    await page
      .locator('section', { hasText: 'Health record' })
      .getByRole('button', { name: /^(add|edit)$/i })
      .click()
    await fill(dialog(), /^Height/, '999')
    await fill(dialog(), /^Doctor mobile/, '123')
    await click(dialog(), /^save$/i)
    await see('Height in cm, 30 to 250', dialog())
    await see('Enter a valid 10-digit mobile', dialog())
  }
)
await test(
  {
    id: 'ST-07',
    module: 'Student health',
    type: 'Add',
    title: 'Save health record with allergy',
    steps: 'Height 135, weight 30, allergies Peanuts → Save.',
    expected: '"Health record saved", BMI shows, allergy in red box',
  },
  async () => {
    await fill(dialog(), /^Height/, '135')
    await fill(dialog(), /^Weight/, '30')
    await fill(dialog(), /^Doctor mobile/, '')
    await fill(dialog(), /^Allergies/, 'Peanuts')
    await click(dialog(), /^save$/i)
    await see('Health record saved')
    await see('16.5')
    await see('Peanuts')
  }
)
await test(
  {
    id: 'ST-08',
    keepOpen: true,
    module: 'Student health',
    type: 'Validation',
    title: 'Vaccination needs a name',
    steps: 'Vaccinations → Add → Save with no name.',
    expected: 'Enter the vaccine name',
  },
  async () => {
    await page.getByRole('button', { name: /^add$/i }).last().click()
    await click(dialog(), /^save$/i)
    await see('Enter the vaccine name', dialog())
  }
)
await test(
  {
    id: 'ST-09',
    module: 'Student health',
    type: 'Add',
    title: 'Add a due vaccination and mark it given',
    steps: 'Vaccine Tdap, due 2026-10-01 → Save → Mark given.',
    expected: 'Shows Overdue, then "marked as given today"',
  },
  async () => {
    await fill(dialog(), /^Vaccine/, 'Tdap')
    await fill(dialog(), /^Next dose due/, '2026-10-01')
    await click(dialog(), /^save$/i)
    await see('Overdue')
    await click(page, /^mark given$/i)
    await see(/marked as given today/)
  }
)
await test(
  {
    id: 'ST-10',
    keepOpen: true,
    module: 'Student behaviour',
    type: 'Validation',
    title: 'Behaviour note needs a title',
    steps: 'Behaviour → Add note → Save with no title.',
    expected: 'Write a short title, at least 3 letters',
  },
  async () => {
    await go(`${studentUrl}?tab=behaviour`)
    await click(page, /^add note$/i)
    await click(dialog(), /^save$/i)
    await see('Write a short title, at least 3 letters', dialog())
  }
)
await test(
  {
    id: 'ST-11',
    module: 'Student behaviour',
    type: 'Add',
    title: 'Add a staff-only concern',
    steps: 'Type Concern, title "RT late three days", switch off parents → Save.',
    expected: 'Note shows with Concern and Staff only badges',
  },
  async () => {
    await dialog().getByRole('radio', { name: 'Concern' }).click()
    await fill(dialog(), /^What happened/, 'RT late three days')
    await dialog().getByRole('switch').click()
    await click(dialog(), /^save$/i)
    await see('RT late three days')
    await see('Staff only')
  }
)
await test(
  {
    id: 'ST-12',
    keepOpen: true,
    module: 'Student documents',
    type: 'Validation',
    title: 'Document upload needs a file',
    steps: 'Documents → Add document → Upload with no file.',
    expected: 'Choose a file to upload',
  },
  async () => {
    await go(`${studentUrl}?tab=documents`)
    await click(page, /^add document/i)
    await click(dialog(), /^upload$/i)
    await see('Choose a file to upload', dialog())
  }
)
await test(
  {
    id: 'ST-13',
    module: 'Student documents',
    type: 'Add',
    title: 'Upload a birth certificate, reject without reason, then verify',
    steps: 'Choose PDF → Upload. Reject with empty reason. Verify.',
    expected: '"Document added" · "Give a reason" · status Verified',
  },
  async () => {
    await dialog().locator('input[type=file]').setInputFiles(samplePdf)
    await click(dialog(), /^upload$/i)
    await see('Document added')
    await see('To check')
    await click(page, /^reject$/i)
    await click(dialog(), /^reject$/i)
    await see('Give a reason', dialog())
    await page.keyboard.press('Escape')
    await click(page, /^verify$/i)
    await see(/verified$/i)
  }
)
await test(
  {
    id: 'ST-14',
    module: 'ID card',
    type: 'View',
    title: 'ID card opens as a PDF',
    steps: 'Student profile → ID card.',
    expected: 'A new tab opens with the PDF',
  },
  async () => {
    await go(studentUrl)
    const popup = page.context().waitForEvent('page', { timeout: 15000 })
    await click(page, /^id card$/i)
    const tab = await popup
    await tab.waitForURL(/^blob:/, { timeout: 15000 })
    await tab.close()
  }
)
await test(
  {
    id: 'ST-15',
    keepOpen: true,
    module: 'Leaving / TC',
    type: 'Validation',
    title: 'Leaving the school needs a reason',
    steps: 'More → Leaving the school → Issue TC with no reason.',
    expected: 'Write the reason for leaving',
  },
  async () => {
    await click(page, /^more/i)
    await page.getByRole('menuitem', { name: /leaving the school/i }).click()
    await click(dialog(), /^issue tc$/i)
    await see('Write the reason for leaving', dialog())
  }
)
await test(
  {
    id: 'ST-16',
    module: 'Leaving / TC',
    type: 'Add',
    title: 'Transfer the student and issue a TC',
    steps: 'Reason "RT family moved" → Issue TC.',
    expected: 'TC number toast, status Transferred, TC banner',
  },
  async () => {
    const popup = page
      .context()
      .waitForEvent('page', { timeout: 15000 })
      .catch(() => null)
    await fill(dialog(), /^Reason/, 'RT family moved')
    await click(dialog(), /^issue tc$/i)
    await see(/TC .*-TC-\d{4}-\d{4} issued/)
    const tab = await popup
    await tab?.close()
    await see('Transferred')
    await see(/TC .*RT family moved/)
  }
)
await test(
  {
    id: 'ST-17',
    module: 'Students',
    type: 'View',
    title: 'Search and class filter on the student list',
    steps: 'Search "Kavin", then choose Class 6.',
    expected: 'Kavin Narayanan is listed',
  },
  async () => {
    await go('/students')
    await page.getByRole('searchbox').first().fill('Kavin')
    await see('Kavin Narayanan')
    await pick(page, 'Filter by class', 'Class 6')
    await see('Kavin Narayanan')
  }
)
await test(
  {
    id: 'ST-18',
    module: 'Students',
    type: 'View',
    title: 'Print ID cards for a class opens a PDF',
    steps: 'Filter Class 6 → Print ID cards.',
    expected: 'A new tab opens with the A4 sheet',
  },
  async () => {
    const popup = page.context().waitForEvent('page', { timeout: 20000 })
    await click(page, /print id cards/i)
    const tab = await popup
    await tab.waitForURL(/^blob:/, { timeout: 20000 })
    await tab.close()
  }
)
await test(
  {
    id: 'ST-19',
    module: 'Excel import',
    type: 'Validation',
    title: 'Import checks rows and reports problems without saving',
    steps: 'Bulk actions → Import → upload a file with one good and one bad row → Check file.',
    expected: 'Report shows 1 ready and 1 to fix with the column message',
  },
  async () => {
    const book = new ExcelJS.Workbook()
    const sheet = book.addWorksheet('Students')
    sheet.addRow([
      'First name *',
      'Date of birth *',
      'Gender *',
      'Class *',
      'Father name',
      'Father mobile',
    ])
    sheet.addRow(['RTGood', '2015-03-14', 'female', '6', 'RT Parent', mobile(3)])
    sheet.addRow(['RTBad', '2015-02-30', 'boy', '13', 'X', '123'])
    const file = path.join(OUT, 'import.xlsx')
    await book.xlsx.writeFile(file)
    await go('/students')
    await click(page, /bulk actions/i)
    await page.getByRole('menuitem', { name: /import from excel/i }).click()
    if (
      !(await dialog()
        .getByRole('button', { name: /check file/i })
        .isDisabled())
    )
      throw new Error('Check enabled without a file')
    await dialog().locator('input[type=file]').setInputFiles(file)
    await click(dialog(), /check file/i)
    await see(/Import 1 student/, dialog(), 20000)
    await see(/Class "13" is not in School setup/, dialog())
    await see(/Father mobile must be a valid 10-digit/, dialog())
  }
)
await test(
  {
    id: 'ST-20',
    module: 'Promotion',
    type: 'View',
    title: 'Promotion preview lists the class and the next year',
    steps: 'Bulk actions → Promote to next year → Class 6.',
    expected: 'Students listed, next class 7 suggested, Promote button enabled',
  },
  async () => {
    await go('/students')
    await click(page, /bulk actions/i)
    await page.getByRole('menuitem', { name: /promote to next year/i }).click()
    await pick(dialog(), 'Class this year', 'Class 6')
    await see('Kavin Narayanan', dialog())
    await see(/2026-27 → 2027-28/, dialog())
    if (
      await dialog()
        .getByRole('button', { name: /^promote \d+/i })
        .isDisabled()
    )
      throw new Error('Promote disabled')
  }
)

await test(
  {
    id: 'AD-01',
    keepOpen: true,
    module: 'Admissions',
    type: 'Validation',
    title: 'New application with nothing filled',
    steps: 'Admissions → New application → save.',
    expected:
      'Choose the class applied for · Enter the first name · Enter the date of birth · Choose a gender · Enter the parent name',
  },
  async () => {
    await go('/admissions')
    await click(page, /^new application/i)
    await dialog().locator('button[type=submit]').click()
    for (const text of [
      'Choose the class applied for',
      'Enter the first name',
      'Enter the date of birth',
      'Choose a gender',
      'Enter the parent name',
    ]) {
      await see(text, dialog())
    }
  }
)
await test(
  {
    id: 'AD-02',
    module: 'Admissions',
    type: 'Add',
    title: 'Take an application, approve it and enrol',
    steps: `RTApp ${RUN}, class 2, parent ${mobile(4)} → save → Approve → Enrol.`,
    expected: 'Status moves Waiting → Approved → Enrolled',
  },
  async () => {
    const form = dialog()
    await pick(form, /class/i, 'Class 2')
    await fill(form, /^First name/, 'RTApp')
    await fill(form, /^Last name/, RUN)
    await fill(form, /^Date of birth/, '2019-02-02')
    await pick(form, 'Gender', 'Girl')
    await fill(form, /^Parent name|^Full name/, `RT Mother ${RUN}`)
    await fill(form, /^Mobile|^Parent mobile/, mobile(4))
    await form.locator('button[type=submit]').click()
    await form.waitFor({ state: 'detached', timeout: 8000 })
    await page.getByRole('searchbox').first().fill(`RTApp ${RUN}`)
    const row = page.getByRole('row', { name: new RegExp(`RTApp ${RUN}`) })
    await see('Waiting', row)
    await row.getByRole('button', { name: 'Approve', exact: true }).click()
    if (await page.getByRole('dialog').count())
      await dialog()
        .getByRole('button', { name: /approve/i })
        .last()
        .click()
    await see('Approved', row)
    await row.getByRole('button', { name: 'Enrol', exact: true }).click()
    await dialog().getByRole('button', { name: /enrol/i }).last().click()
    await see('Enrolled', row)
    const list = await api('GET', `/admin/students?search=RTApp`)
    created.students.push(...list.data.items.map((item) => item.id))
  }
)

await test(
  {
    id: 'PG-01',
    module: 'Parents',
    type: 'Validation',
    title: 'Edit parent rejects a bad mobile',
    steps: `Parents → search ${mobile(2)} → open → Edit → mobile 123 → Save.`,
    expected: 'Enter a valid 10-digit mobile',
  },
  async () => {
    await go('/guardians')
    await page.getByRole('searchbox').first().fill(mobile(2))
    await see(`RT Father ${RUN}`)
    await page.getByText(`RT Father ${RUN}`).first().click()
    await click(page, /^edit/i)
    await fill(dialog(), /^Mobile/, '123')
    await dialog().locator('button[type=submit]').click()
    await see('Enter a valid 10-digit mobile', dialog())
  }
)

let staffUrl = ''
await test(
  {
    id: 'SF-01',
    keepOpen: true,
    module: 'Staff',
    type: 'Validation',
    title: 'Add staff with nothing filled',
    steps: 'Staff → Add staff → save.',
    expected:
      'Enter the full name · mobile · Choose at least one role · Choose teaching or non-teaching · Enter the designation',
  },
  async () => {
    await go('/staff')
    await click(page, /^add staff/i)
    await dialog().locator('button[type=submit]').click()
    for (const text of [
      'Enter the full name',
      'Enter a valid 10-digit mobile number',
      'Choose at least one role',
      'Choose teaching or non-teaching',
      'Enter the designation',
    ]) {
      await see(text, dialog())
    }
  }
)
await test(
  {
    id: 'SF-02',
    module: 'Staff',
    type: 'Add',
    title: 'Add a teacher',
    steps: `RT Teacher ${RUN}, ${mobile(5)}, role Teacher, teaching, BT Assistant, no invite.`,
    expected: 'Staff profile opens with the employee number',
  },
  async () => {
    const form = dialog()
    await fill(form, /^Full name/, `RT Teacher ${RUN}`)
    await fill(form, /^Mobile/, mobile(5))
    await form.getByRole('button', { name: 'Teacher', exact: true }).click()
    await pick(form, 'Staff type', /^Teaching/)
    await fill(form, /^Designation/, 'BT Assistant')
    const invite = form.getByRole('switch').last()
    if ((await invite.getAttribute('aria-checked')) === 'true') await invite.click()
    await form.locator('button[type=submit]').click()
    await page.waitForURL(/\/staff\/\d+/, { timeout: 10000 })
    await see(`RT Teacher ${RUN}`)
    await see(/-EMP-\d{4}/)
    staffUrl = new URL(page.url()).pathname
    created.staff.push(Number(staffUrl.split('/').pop()))
  }
)
await test(
  {
    id: 'SF-03',
    keepOpen: true,
    module: 'Staff',
    type: 'Validation',
    title: 'Bank details: wrong IFSC and account number',
    steps: 'Bank tab → Edit → IFSC ABC, account 12 → Save.',
    expected: 'IFSC and account number messages show',
  },
  async () => {
    if (!staffUrl) throw new Error('No staff from SF-02')
    await go(`${staffUrl}?tab=bank`)
    await page
      .getByRole('button', { name: /bank details/i })
      .first()
      .click()
    await fill(dialog(), /holder/i, 'RT Teacher')
    await fill(dialog(), /^Bank\*?$/, 'Indian Bank')
    await fill(dialog(), /IFSC/i, 'ABC')
    await fill(dialog(), /^Account number/i, '12')
    await dialog().locator('button[type=submit]').click()
    await see(/IFSC/i, dialog())
    await see(/9 to 18 digits/i, dialog())
  }
)
await test(
  {
    id: 'SF-04',
    module: 'Staff',
    type: 'Add',
    title: 'Save bank details; only last 4 digits show',
    steps: 'IFSC IDIB000A045, account 6012349876 → Save.',
    expected: 'Bank tab shows XXXX9876',
  },
  async () => {
    await fill(dialog(), /IFSC/i, 'IDIB000A045')
    await fill(dialog(), /^Account number/i, '6012349876')
    await dialog().locator('button[type=submit]').click()
    await dialog().waitFor({ state: 'detached', timeout: 8000 })
    await see('XXXX9876')
  }
)
await test(
  {
    id: 'SF-05',
    module: 'Staff',
    type: 'Add',
    title: 'Upload a staff document and verify it',
    steps: 'Documents tab → Add document → PDF → Upload → Verify.',
    expected: 'Document shows Verified',
  },
  async () => {
    await go(`${staffUrl}?tab=documents`)
    await click(page, /^add document/i)
    await dialog().locator('input[type=file]').setInputFiles(samplePdf)
    await click(dialog(), /^upload$/i)
    await see('Document added')
    await click(page, /^verify$/i)
    await see(/verified$/i)
  }
)
await test(
  {
    id: 'SF-06',
    module: 'Staff',
    type: 'View',
    title: 'Need attention card filters the list',
    steps: 'Staff → click Need attention card.',
    expected: 'URL has needs_attention=true and the list shows attention badges',
  },
  async () => {
    await go('/staff')
    await page
      .getByRole('button', { name: /need attention/i })
      .first()
      .click()
    await page.waitForURL(/needs_attention=true/, { timeout: 8000 })
    await see(
      /Bank details missing|Documents to check|No documents|Overloaded|Document rejected|No classes/
    )
  }
)
await test(
  {
    id: 'SF-07',
    module: 'Teacher assignments',
    type: 'View',
    title: 'Assignment matrix shows sections, subjects and teacher loads',
    steps: 'People → Teacher assignments.',
    expected: 'Section 6 - A with Mathematics and teacher list with loads',
  },
  async () => {
    await go('/staff/assignments')
    await see('Mathematics')
    await see('Priya Venkatesh')
  }
)

await test(
  {
    id: 'FL-01',
    module: 'Bus tracking',
    type: 'View',
    title: 'Bus tracking page shows live state cards and the bus list',
    steps: 'Fleet → Bus tracking.',
    expected: 'Buses, Moving now, Stopped and Offline cards, and the bus list',
  },
  async () => {
    await go('/fleet')
    await see('Moving now')
    await see('Offline')
    await see(/Truck 01|No buses yet/)
  }
)
await test(
  {
    id: 'FL-02',
    module: 'Bus tracking',
    type: 'View',
    title: 'MQTT console and system status are gone from the admin web',
    steps: 'Open the sidebar and /console.',
    expected: 'No MQTT console or Devices menu, no API/Database/MQTT status panel',
  },
  async () => {
    await go('/')
    const nav = page.getByRole('navigation').first()
    for (const text of ['MQTT console', 'Devices']) {
      if (await nav.getByText(text, { exact: true }).count())
        throw new Error(`${text} still in the menu`)
    }
    if (await page.getByText('All systems up').count()) throw new Error('Status chip still shown')
    await go('/console')
    await see(/not found|could not find|404/i)
  }
)

const superAdmin = await signedInContext('9999999999', '.auth-super.json')
{
  const previous = page
  page = superAdmin.page
  await test(
    {
      id: 'SC-01',
      keepOpen: true,
      module: 'Schools',
      type: 'Validation',
      title: 'Add school with nothing filled',
      steps: 'Super admin → Schools → Add school → Create school.',
      expected: 'Enter the school name · 2 to 20 letters or digits',
    },
    async () => {
      await go('/schools')
      await click(page, /^add school/i)
      await click(dialog(), /^create school$/i)
      await see('Enter the school name', dialog())
      await see('2 to 20 letters or digits', dialog())
    }
  )
  await test(
    {
      id: 'SC-02',
      module: 'Schools',
      type: 'Validation',
      title: 'School admin needs both name and a valid mobile',
      steps: 'Admin name filled, mobile 123 → Create school.',
      expected: 'Enter a valid 10-digit mobile',
    },
    async () => {
      await fill(dialog(), /^School name/, 'RT School')
      await fill(dialog(), /^Code/, `RT${RUN}`)
      await fill(dialog(), /^First admin name/, 'RT Admin')
      await fill(dialog(), /^First admin mobile/, '123')
      await click(dialog(), /^create school$/i)
      await see('Enter a valid 10-digit mobile', dialog())
    }
  )
  page = previous
}

const D4 = (meta, fn) => test({ ...meta, day: 'Day 4' }, fn)
const istToday = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)
const lastSchoolDay =
  new Date(`${istToday}T00:00:00Z`).getUTCDay() === 0
    ? new Date(Date.parse(`${istToday}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
    : istToday

await D4(
  {
    id: 'AT-01',
    module: 'Attendance',
    type: 'View',
    title: 'Attendance board lists sections with totals',
    steps: `Open Attendance for ${lastSchoolDay}.`,
    expected: 'Insight cards and the section list with Class 6 - A',
  },
  async () => {
    await go(`/attendance?tab=students&date=${lastSchoolDay}`)
    await see('Sections not marked')
    await see('Class 6 - A')
  }
)
await D4(
  {
    id: 'AT-02',
    module: 'Attendance',
    type: 'Add',
    title: 'Mark a section all present and save',
    steps: 'Click Class 6 - A, click All present, click Save attendance.',
    expected: 'Toast "Attendance saved"',
    keepOpen: true,
  },
  async () => {
    await page.getByText('Class 6 - A').locator('visible=true').first().click()
    await see('Mark attendance', dialog())
    await click(dialog(), 'All present')
    await click(dialog(), 'Save attendance')
    await see(/Attendance saved/)
  }
)
await D4(
  {
    id: 'AT-03',
    module: 'Attendance',
    type: 'View',
    title: 'Monthly report of a section',
    steps: 'In the section sheet, switch to Monthly report.',
    expected: 'School days marked and a % per student',
  },
  async () => {
    await dialog().getByRole('radio', { name: 'Monthly report' }).click()
    await see(/school days marked/, dialog())
  }
)
await D4(
  {
    id: 'AT-04',
    module: 'Staff attendance',
    type: 'Validation',
    title: 'Correct staff attendance needs a reason',
    steps: 'Staff tab, click Correct on the first row, Save correction with no reason.',
    expected: '"Give a reason of at least 3 characters"',
  },
  async () => {
    await go(`/attendance?tab=staff&date=${lastSchoolDay}`)
    await see('Staff check-ins')
    await page.getByRole('button', { name: /^Correct attendance for/ }).first().click()
    await click(dialog(), 'Save correction')
    await see('Give a reason of at least 3 characters', dialog())
  }
)
await D4(
  {
    id: 'AT-05',
    module: 'Student leave',
    type: 'Validation',
    title: 'Rejecting a parent leave request needs a reason',
    steps: 'Leave requests, Student leave, Reject the waiting request with an empty reason.',
    expected: '"Give a reason for rejecting"; nothing is saved',
  },
  async () => {
    await go('/attendance?tab=leave&leave=student&status=pending')
    await page.getByRole('button', { name: /^Reject leave for/ }).first().click()
    await click(dialog(), /^Reject$/)
    await see('Give a reason for rejecting', dialog())
  }
)
await D4(
  {
    id: 'AT-06',
    module: 'Staff leave',
    type: 'View',
    title: 'Staff leave shows the approval stage',
    steps: 'Leave requests, Staff leave.',
    expected: 'The waiting request shows "Waiting for principal"',
  },
  async () => {
    await go('/attendance?tab=leave&leave=staff')
    await see('Waiting for principal')
  }
)
await D4(
  {
    id: 'TT-01',
    module: 'Timetable',
    type: 'View',
    title: 'Timetable builder shows the week and subject plan',
    steps: 'Open Timetable, choose 6 - A.',
    expected: 'Grid "Timetable of 6 - A" and the Subject plan panel',
  },
  async () => {
    await go('/timetable?tab=builder')
    await pick(page, 'Section', '6 - A')
    await page.getByLabel('Timetable of 6 - A').waitFor({ timeout: 8000 })
    await see('Subject plan')
  }
)
await D4(
  {
    id: 'TT-02',
    module: 'Timetable',
    type: 'Validation',
    title: 'Saving a period needs a subject',
    steps: 'Click an empty period, Save period with no subject.',
    expected: '"Choose a subject"',
  },
  async () => {
    await page.getByRole('button', { name: /, empty$/ }).first().click()
    await click(dialog(), 'Save period')
    await see('Choose a subject', dialog())
  }
)
await D4(
  {
    id: 'TT-03',
    module: 'Timetable',
    type: 'Validation',
    title: 'Teacher clash is blocked',
    steps: 'Section 6 - B, Monday Period 1, any subject, teacher Priya Venkatesh (teaches 6 - A then), Save period.',
    expected: 'Toast "Priya Venkatesh already teaches 6 - A in period 1 on Monday"; nothing saved',
  },
  async () => {
    await go('/timetable?tab=builder')
    await pick(page, 'Section', '6 - B')
    await page.getByRole('button', { name: /^Monday Period 1/ }).first().click()
    await dialog().getByRole('combobox', { name: 'Subject' }).click()
    await page.getByRole('option').first().click()
    await pick(dialog(), 'Teacher', /^Priya Venkatesh$/)
    await click(dialog(), 'Save period')
    await see(/already teaches 6 - A/)
  }
)
await D4(
  {
    id: 'TT-06',
    module: 'Timetable',
    type: 'View',
    title: 'Subject picker lists school subjects even when the class has none chosen',
    steps: 'Builder, Class 12 - A (no class subjects), click Monday Period 1, open Subject.',
    expected: 'School subjects listed with "Not in class plan", not "No match"',
  },
  async () => {
    await go('/timetable?tab=builder')
    await pick(page, 'Section', '12 - A')
    await page.getByRole('button', { name: /^Monday Period 1/ }).first().click()
    await dialog().getByRole('combobox', { name: 'Subject' }).click()
    await page.getByRole('option', { name: /Mathematics/ }).first().waitFor({ timeout: 8000 })
  }
)
await D4(
  {
    id: 'TT-04',
    module: 'Timetable',
    type: 'View',
    title: 'Workload report',
    steps: 'Timetable, Workload tab.',
    expected: 'Teacher workload table with Mon to Sat counts',
  },
  async () => {
    await go('/timetable?tab=workload')
    await see('Teacher workload')
    await see('Priya Venkatesh')
  }
)
await D4(
  {
    id: 'TT-05',
    module: 'Timetable',
    type: 'Validation',
    title: 'A period in use cannot be removed from the bell schedule',
    steps: 'Bell schedule, remove Period 8, Save bell schedule.',
    expected: '"The timetable uses period 8…"; schedule unchanged',
  },
  async () => {
    await go('/timetable?tab=bells')
    await click(page, 'Remove Period 8')
    await click(page, 'Save bell schedule')
    await see(/timetable uses period 8/)
    await click(page, 'Discard')
  }
)

{
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: path.join(ROOT, '.auth-admin.json'),
  })
  const previous = page
  page = await phone.newPage()
  for (const [id, url, text] of [
    ['RS-01', '/students', 'Aadhavan Senthil'],
    ['RS-02', '/staff', 'Priya Venkatesh'],
    ['RS-03', `${studentUrl || '/students'}`, /Profile|Students/],
    ['RS-04', '/attendance', 'Sections not marked'],
    ['RS-05', '/timetable', 'Subject plan'],
  ]) {
    await test(
      {
        id,
        module: 'Responsive',
        type: 'View',
        title: `${url} fits a phone without sideways scroll`,
        steps: `Open ${url} at 390 x 844.`,
        expected: 'Content visible and page width equals screen width',
      },
      async () => {
        await go(url)
        await see(text)
        const width = await page.evaluate(() => document.documentElement.scrollWidth)
        if (width > 391) throw new Error(`Page is ${width}px wide`)
      }
    )
  }
  await phone.close()
  page = previous
}

const cleanup = []
for (const id of created.students) cleanup.push(api('DELETE', `/admin/students/${id}`))
for (const id of created.staff)
  cleanup.push(
    api('PATCH', `/admin/staff/${id}`, { status: 'resigned' }).then(() =>
      api('DELETE', `/admin/staff/${id}`)
    )
  )
for (const id of created.users) cleanup.push(api('DELETE', `/admin/users/${id}`))
for (const id of created.subjects) cleanup.push(api('DELETE', `/admin/subjects/${id}`))
for (const id of created.holidays) cleanup.push(api('DELETE', `/admin/holidays/${id}`))
const leftovers = await api('GET', '/admin/admissions?search=RTApp&limit=100')
for (const item of leftovers.data?.items ?? []) {
  if (item.status !== 'enrolled') cleanup.push(api('DELETE', `/admin/admissions/${item.id}`))
}
await Promise.allSettled(cleanup)

await browser.close()
const passed = results.filter((row) => row.status === 'Pass').length
fs.writeFileSync(
  path.join(OUT, 'frontend.json'),
  JSON.stringify({ run_at: new Date().toISOString(), base_url: BASE, day: DAY, results }, null, 2)
)
console.log(`\n${passed}/${results.length} passed. Results: e2e/results/frontend.json`)
process.exit(passed === results.length ? 0 : 1)
