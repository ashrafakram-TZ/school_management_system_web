import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const CHROME = process.env.E2E_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const DAY = process.env.E2E_DAY ?? 'Day 8'
const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const OUT = path.join(ROOT, 'results')
const SHOTS = path.join(OUT, 'screenshots', 'day8')
fs.mkdirSync(SHOTS, { recursive: true })

const results = []
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: process.env.E2E_HEADED !== '1',
})
const RUN = String(Date.now()).slice(-5)

async function signIn(mobile, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto(`${BASE}/login`)
  await page.getByLabel(/mobile/i).fill(mobile)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.getByRole('button', { name: /continue with otp/i }).click()
    const ok = await page
      .getByText('Enter the code')
      .waitFor({ timeout: 8000 })
      .then(
        () => true,
        () => false
      )
    if (ok) break
    await page.waitForTimeout(32000)
  }
  await page.keyboard.type('123456')
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 })
  return { context, page }
}

let page
const KEEP_OPEN = new Set(['DY-05', 'DY-06', 'DY-07', 'AN-02', 'AN-03', 'AN-05', 'CH-02', 'CH-03'])
async function test(id, module, type, title, steps, expected, fn) {
  const started = Date.now()
  const row = {
    day: DAY,
    id,
    module,
    type,
    title,
    steps,
    expected,
    status: 'Pass',
    actual: expected,
    screenshot: '',
    ms: 0,
  }
  try {
    await fn()
  } catch (error) {
    row.status = 'Fail'
    row.actual = String(error?.message ?? error)
      .split('\n')[0]
      .slice(0, 300)
  }
  row.screenshot = `${id}.png`
  await page.screenshot({ path: path.join(SHOTS, row.screenshot) }).catch(() => null)
  row.ms = Date.now() - started
  results.push(row)
  console.log(
    `${row.status === 'Pass' ? 'PASS' : 'FAIL'}  ${id.padEnd(7)} ${title}${row.status === 'Fail' ? `\n        ${row.actual}` : ''}`
  )
  for (let i = 0; i < 3 && !KEEP_OPEN.has(id) && (await page.getByRole('dialog').count()); i += 1) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)
  }
}
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const rows = () => page.locator('table tbody tr')
const visible = (locator) => locator.filter({ visible: true }).first()
const toast = (text) => page.getByText(text).first().waitFor({ timeout: 8000 })
const noSideScroll = async () => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  assert(overflow <= 0, `page scrolls sideways by ${overflow}px`)
}

const API = process.env.E2E_API_URL ?? `${BASE}/api/v1`
async function apiCall(method, url, token, body) {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return (await res.json()).data
}
async function seedDiary() {
  await apiCall('POST', '/auth/otp/request', null, { mobile: '9000000004', app: 'mobile' })
  const session = await apiCall('POST', '/auth/otp/verify', null, {
    mobile: '9000000004',
    otp: '123456',
    client: { app: 'mobile' },
  })
  const token = session.access_token
  const classes = await apiCall('GET', '/mobile/teacher/classes', token)
  const section = classes.find((row) => row.is_class_teacher) ?? classes[0]
  const students = await apiCall(
    'GET',
    `/mobile/teacher/sections/${section.section_id}/students`,
    token
  )
  const student = (students.items ?? students)[0]
  await apiCall('POST', '/mobile/teacher/diary', token, {
    type: 'remark',
    scope: 'students',
    student_ids: [student.id],
    title: `UI ${RUN}: remark for review`,
    body: 'Please encourage more reading at home.',
  })
  await apiCall('POST', '/mobile/teacher/diary', token, {
    type: 'homework',
    scope: 'section',
    section_id: section.section_id,
    title: `UI ${RUN}: homework`,
    body: 'Finish the worksheet.',
  })
}
await seedDiary()

const admin = await signIn('9876543210')
page = admin.page

await test(
  'D8-01',
  'Navigation',
  'View',
  'Communication menu shows Meetings, Diary, Announcements and Chat audit',
  'Sign in as 9876543210 and look at the sidebar.',
  'Four links under Communication',
  async () => {
    for (const href of ['/meetings', '/diary', '/announcements', '/chat']) {
      await visible(page.locator(`a[href="${href}"]`)).waitFor()
    }
  }
)

await test(
  'DY-01',
  'Diary',
  'View',
  'Diary page loads with four insight cards and posts',
  'Click Diary in the sidebar.',
  'Cards and rows shown',
  async () => {
    await visible(page.locator('a[href="/diary"]')).click()
    await page.getByRole('heading', { name: 'Diary', level: 1 }).waitFor()
    for (const label of [
      'Waiting for review',
      'Published today',
      'Homework due this week',
      'Sent back',
    ]) {
      await page.getByText(label, { exact: true }).first().waitFor()
    }
    await rows().first().waitFor()
  }
)

await test(
  'DY-02',
  'Diary',
  'View',
  'Shortcut G then Z opens the diary',
  'Open /meetings, press G then Z.',
  'URL /diary',
  async () => {
    await page.goto(`${BASE}/meetings?page=1`)
    await page.getByRole('heading', { name: 'Meetings', level: 1 }).waitFor()
    await page.keyboard.press('g')
    await page.keyboard.press('z')
    await page.waitForURL(/\/diary/, { timeout: 5000 })
  }
)

await test(
  'DY-03',
  'Diary',
  'View',
  'Waiting-for-review card filters the list',
  'Click Waiting for review.',
  'status=pending_review, only waiting posts',
  async () => {
    await page.goto(`${BASE}/diary?page=1`)
    await page.getByRole('button', { name: /Waiting for review/ }).click()
    await page.waitForURL(/status=pending_review/)
    await page.waitForTimeout(800)
    const texts = await rows().allInnerTexts()
    assert(
      texts.length > 0 && texts.every((t) => t.includes('Waiting for review')),
      'other statuses shown'
    )
  }
)

await test(
  'DY-04',
  'Diary',
  'View',
  'Type filter shows only homework',
  'Type filter → Homework.',
  'type=homework',
  async () => {
    await page.goto(`${BASE}/diary?page=1`)
    await page.getByRole('combobox', { name: 'Filter by type' }).click()
    await page.getByRole('option', { name: 'Homework' }).click()
    await page.waitForURL(/type=homework/)
    await page.waitForTimeout(800)
    const texts = await rows().allInnerTexts()
    assert(texts.length > 0 && texts.every((t) => t.includes('Homework')), 'other types shown')
  }
)

await test(
  'DY-05',
  'Diary',
  'Validation',
  'Sending back needs a reason',
  'Open a waiting post → Send back → submit empty.',
  '"Give the teacher a reason"',
  async () => {
    await page.goto(`${BASE}/diary?page=1&status=pending_review`)
    await rows().first().click()
    const sheet = page.getByRole('dialog')
    await sheet.getByRole('button', { name: 'Send back' }).click()
    await page.getByRole('button', { name: 'Send back' }).last().click()
    await page.getByText('Give the teacher a reason').waitFor()
  }
)

await test(
  'DY-06',
  'Diary',
  'Add',
  'Send a post back with a reason',
  'Type a reason and send back.',
  'Status Sent back, reason in Review',
  async () => {
    await page.getByLabel('Reason').fill(`UI test ${RUN}: please rephrase`)
    await page.getByRole('button', { name: 'Send back' }).last().click()
    await toast('Sent back to the teacher')
    await page.getByRole('dialog').getByText('Sent back').first().waitFor()
    await page.getByRole('dialog').getByText(`UI test ${RUN}: please rephrase`).waitFor()
  }
)

await test(
  'DY-07',
  'Diary',
  'View',
  'A published post lists every student and who has seen it',
  'Open a published post.',
  'Seen by parents list',
  async () => {
    await page.goto(`${BASE}/diary?page=1&status=published`)
    await rows().first().click()
    const sheet = page.getByRole('dialog')
    await sheet.getByText(/Seen by parents · \d+ of \d+/).waitFor()
    assert(
      (await sheet.locator('section:has(h3:text-matches("Seen by parents")) li').count()) > 0,
      'no recipients'
    )
  }
)

await test(
  'DY-08',
  'Diary',
  'Add',
  'Hide a published post and show it again',
  'Hide from parents → Hide → Show again.',
  'Hidden, then Published',
  async () => {
    const sheet = page.getByRole('dialog')
    await sheet.getByRole('button', { name: 'Hide from parents' }).click()
    await page.getByRole('button', { name: 'Hide', exact: true }).click()
    await toast('Hidden from parents')
    await sheet.getByRole('button', { name: 'Show again' }).click()
    await toast('Shown to parents again')
  }
)

await test(
  'AN-01',
  'Announcements',
  'View',
  'Announcements page loads with insight cards',
  'Click Announcements in the sidebar.',
  'Cards and the New announcement button',
  async () => {
    await visible(page.locator('a[href="/announcements"]')).click()
    await page.getByRole('heading', { name: 'Announcements', level: 1 }).waitFor()
    for (const label of ['Published', 'Scheduled', 'Drafts', 'Urgent and live']) {
      await page.getByText(label, { exact: true }).first().waitFor()
    }
    await page.getByRole('button', { name: 'New announcement' }).first().waitFor()
  }
)

await test(
  'AN-02',
  'Announcements',
  'Validation',
  'New announcement with nothing filled',
  'New announcement → Save draft.',
  'Enter a title · Write the announcement',
  async () => {
    await page.getByRole('button', { name: 'New announcement' }).first().click()
    await page.getByRole('button', { name: 'Save draft' }).click()
    await page.getByText('Enter a title').waitFor()
    await page.getByText('Write the announcement').waitFor()
  }
)

await test(
  'AN-03',
  'Announcements',
  'Validation',
  'Classes audience needs a class or section',
  'Send to → Parents of chosen classes, save.',
  'Choose at least one class or section',
  async () => {
    await page.getByLabel('Title').fill(`UI ${RUN} trip`)
    await page.locator('#a-body').fill('Science trip on Monday.')
    await page.getByRole('combobox', { name: 'Send to' }).click()
    await page.getByRole('option', { name: /chosen classes/ }).click()
    await page.getByRole('button', { name: 'Save draft' }).click()
    await page.getByText('Choose at least one class or section').waitFor()
  }
)

await test(
  'AN-04',
  'Announcements',
  'Add',
  'Save a draft for one section',
  'Add 6 - A, Save draft.',
  'Toast Draft saved, row with Draft',
  async () => {
    await page.getByRole('combobox', { name: 'Add a class or section' }).click()
    await page.getByRole('option', { name: /6 - A/ }).first().click()
    await page.getByRole('button', { name: 'Save draft' }).click()
    await toast('Draft saved')
    await page.getByLabel('Search announcements').first().fill(`UI ${RUN}`)
    await page.waitForTimeout(900)
    const text = await rows().first().innerText()
    assert(text.includes('Draft') && text.includes('6 - A'), text.replace(/\s+/g, ' '))
  }
)

await test(
  'AN-05',
  'Announcements',
  'Add',
  'Send the draft now',
  'Open it → Send now.',
  'Published with recipients',
  async () => {
    await rows().first().click()
    await page.getByRole('dialog').getByRole('button', { name: 'Send now' }).click()
    await toast('Announcement sent')
    await page.getByRole('dialog').getByText('Published').first().waitFor()
    await page.getByRole('dialog').getByRole('radio', { name: 'Not read' }).click()
    await page
      .getByRole('dialog')
      .getByText(/Parent ·/)
      .first()
      .waitFor()
  }
)

await test(
  'AN-06',
  'Announcements',
  'Add',
  'Archive it after a confirmation',
  'Archive → confirm.',
  'Archived',
  async () => {
    await page.getByRole('dialog').getByRole('button', { name: 'Archive' }).click()
    await page.getByRole('button', { name: 'Archive' }).last().click()
    await toast('Announcement archived')
  }
)

await test(
  'CH-01',
  'Chat audit',
  'View',
  'Chat audit lists conversations; Reported card filters them',
  'Click Chat audit → Reported messages.',
  'flagged=true in the URL',
  async () => {
    await page.goto(`${BASE}/chat?page=1`)
    await page.getByRole('heading', { name: 'Chat audit', level: 1 }).waitFor()
    await rows().first().waitFor()
    await page.getByRole('button', { name: /Reported messages/ }).click()
    await page.waitForURL(/flagged=true/)
  }
)

await test(
  'CH-02',
  'Chat audit',
  'View',
  'Opening a conversation shows the transcript and records the visit',
  'Clear filters, open the first conversation.',
  'Transcript and "opened the conversation" in Office access',
  async () => {
    await page.goto(`${BASE}/chat?page=1`)
    await rows().first().click()
    const sheet = page.getByRole('dialog')
    await sheet.getByText('Opening this conversation is recorded').waitFor()
    await sheet.getByText('opened the conversation').first().waitFor()
  }
)

await test(
  'CH-03',
  'Chat audit',
  'Validation',
  'Hiding a message needs a reason',
  'Hide → Hide message with nothing typed.',
  'Give a reason for hiding it',
  async () => {
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Hide', exact: true })
      .first()
      .click()
    await page.getByRole('button', { name: 'Hide message' }).click()
    await page.getByText('Give a reason for hiding it').waitFor()
  }
)

await test(
  'CH-04',
  'Chat audit',
  'Add',
  'Hide a message, then show it again',
  'Type a reason → Hide message → Show again.',
  'Hidden by …, then shown',
  async () => {
    await page.getByLabel('Reason').fill(`UI ${RUN} hide`)
    await page.getByRole('button', { name: 'Hide message' }).click()
    await toast('Message hidden')
    await page.getByRole('dialog').getByText(`UI ${RUN} hide`).first().waitFor()
    await page.getByRole('dialog').getByRole('button', { name: 'Show again' }).first().click()
    await toast('Message shown again')
  }
)

await test(
  'ST-01',
  'School setup',
  'Validation',
  'Office hours that end before they start are refused',
  'School setup → School profile → set 17:00 to 08:00 → Save settings.',
  'Office hours must end after they start',
  async () => {
    await page.goto(`${BASE}/setup?tab=profile`)
    await page.getByText('Diary and chat').waitFor()
    await page.getByLabel('Chat office hours start').fill('17:00')
    await page.getByLabel('Chat office hours end').fill('08:00')
    await page.getByRole('button', { name: 'Save settings' }).click()
    await page.getByText('Office hours must end after they start').waitFor()
  }
)

await test(
  'ST-02',
  'School setup',
  'Add',
  'Change the diary review mode and save',
  'Diary review → Review every diary post → Save; then back.',
  'Saved twice',
  async () => {
    await page.getByLabel('Chat office hours start').fill('08:00')
    await page.getByLabel('Chat office hours end').fill('17:00')
    await page.getByRole('combobox', { name: 'Diary review' }).click()
    await page.getByRole('option', { name: 'Review every diary post' }).click()
    await page.getByRole('button', { name: 'Save settings' }).click()
    await toast('Communication settings saved')
    await page.getByText('Nothing reaches parents until the office approves it').waitFor()
    await page.getByRole('combobox', { name: 'Diary review' }).click()
    await page.getByRole('option', { name: 'Review remarks and feedback only' }).click()
    await page.getByRole('button', { name: 'Save settings' }).click()
    await page.waitForTimeout(1200)
  }
)

await test(
  'MT-26',
  'Meetings',
  'View',
  'Meetings shows the new statuses (in progress, over time)',
  'Open /meetings, status filter.',
  'In progress and Over time options',
  async () => {
    await page.goto(`${BASE}/meetings?page=1`)
    await page.getByRole('combobox', { name: 'Filter by status' }).click()
    await page.getByRole('option', { name: 'In progress' }).waitFor()
    await page.getByRole('option', { name: 'Over time' }).waitFor()
    await page.keyboard.press('Escape')
  }
)

const state = await admin.context.storageState()
await admin.context.close()
const phone = {
  context: await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: state }),
}
page = await phone.context.newPage()
for (const [id, url, heading] of [
  ['RS-10', '/diary?page=1', 'Diary'],
  ['RS-11', '/announcements?page=1', 'Announcements'],
  ['RS-12', '/chat?page=1', 'Chat audit'],
]) {
  await test(
    id,
    'Responsive',
    'View',
    `${url.split('?')[0]} fits a phone without sideways scroll`,
    `Open ${url} at 390 x 844.`,
    'Content visible and page width equals screen width',
    async () => {
      await page.goto(`${BASE}${url}`)
      await page.getByRole('heading', { name: heading, level: 1 }).waitFor()
      await page.waitForTimeout(800)
      await noSideScroll()
    }
  )
}
await phone.context.close()

const transport = await signIn('9000000003')
page = transport.page
await test(
  'D8-02',
  'Navigation',
  'Validation',
  'Transport in-charge does not see diary, announcements or chat audit',
  'Sign in as 9000000003.',
  'No links',
  async () => {
    await visible(page.locator('a[href="/guardians"]')).waitFor()
    for (const href of ['/diary', '/announcements', '/chat']) {
      assert(!(await page.locator(`a[href="${href}"]`).count()), `${href} link visible`)
    }
  }
)
await transport.context.close()

const principal = await signIn('9000000001')
page = principal.page
await test(
  'D8-03',
  'Navigation',
  'View',
  'Principal sees and opens all three pages',
  'Sign in as 9000000001; open each.',
  'Each page loads',
  async () => {
    for (const [href, heading] of [
      ['/diary', 'Diary'],
      ['/announcements', 'Announcements'],
      ['/chat', 'Chat audit'],
    ]) {
      await visible(page.locator(`a[href="${href}"]`)).click()
      await page.getByRole('heading', { name: heading, level: 1 }).waitFor()
    }
  }
)
await principal.context.close()

await browser.close()
fs.writeFileSync(path.join(OUT, 'day8-ui.json'), JSON.stringify({ day: DAY, results }, null, 2))
const failed = results.filter((row) => row.status === 'Fail').length
console.log(`\n${results.length - failed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
