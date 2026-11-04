import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const CHROME = process.env.E2E_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const DAY = process.env.E2E_DAY ?? 'Day 8'
const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const OUT = path.join(ROOT, 'results')
const SHOTS = path.join(OUT, 'screenshots', 'meetings')
fs.mkdirSync(SHOTS, { recursive: true })

const results = []
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: process.env.E2E_HEADED !== '1',
})

async function signIn(mobileNumber, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto(`${BASE}/login`)
  await page.getByLabel(/mobile/i).fill(mobileNumber)
  await page.getByRole('button', { name: /continue with otp/i }).click()
  await page.getByText('Enter the code').waitFor({ timeout: 15000 })
  await page.keyboard.type('123456')
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 })
  return { context, page }
}

async function apiGet(page, url) {
  return page.evaluate(async (target) => {
    const session = JSON.parse(localStorage.getItem('tz-session') ?? '{}')
    const res = await fetch(target, { headers: { authorization: `Bearer ${session.accessToken}` } })
    return (await res.json()).data
  }, `/api/v1${url}`)
}

let page
async function test(id, title, expected, fn) {
  const started = Date.now()
  const row = {
    day: DAY,
    id,
    module: 'Meetings',
    title,
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
  await page
    .screenshot({ path: path.join(SHOTS, row.screenshot), fullPage: false })
    .catch(() => null)
  row.ms = Date.now() - started
  results.push(row)
  console.log(
    `${row.status === 'Pass' ? 'PASS' : 'FAIL'}  ${id.padEnd(7)} ${title}${row.status === 'Fail' ? `\n        ${row.actual}` : ''}`
  )
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const rowsLocator = () => page.locator('table tbody tr')

const admin = await signIn('9876543210')
page = admin.page

const all = await apiGet(page, '/admin/meetings?limit=100&search=QA')
const completed = all.items.find((m) => m.status === 'completed')
const cancelled = all.items.find((m) => m.status === 'cancelled' && m.cancel_reason)
assert(completed && cancelled, 'Run the API test first so QA meetings exist')

await test(
  'MT-01',
  'Meetings appears under Communication in the sidebar',
  'Link visible and opens /meetings',
  async () => {
    await page.locator('a[href="/meetings"]').filter({ visible: true }).first().click()
    await page.waitForURL(/\/meetings/)
    await page.getByRole('heading', { name: 'Meetings', level: 1 }).waitFor()
  }
)

await test(
  'MT-02',
  'Keyboard shortcut G then J opens Meetings',
  'URL becomes /meetings',
  async () => {
    await page.goto(`${BASE}/guardians?page=1`)
    await page.getByRole('heading', { name: 'Parents', level: 1 }).waitFor()
    await page.keyboard.press('g')
    await page.keyboard.press('j')
    await page.waitForURL(/\/meetings/, { timeout: 5000 })
  }
)

await test(
  'MT-03',
  'List loads with four insight cards and meeting rows',
  '4 cards, rows shown, total in toolbar',
  async () => {
    await page.goto(`${BASE}/meetings?page=1`)
    for (const label of ['Today', 'Coming up', 'Live now', 'Missed']) {
      await page.getByText(label, { exact: true }).first().waitFor()
    }
    await rowsLocator().first().waitFor()
    assert((await rowsLocator().count()) >= 3, 'expected at least 3 rows')
    await page
      .getByText(/\d+ meetings/)
      .first()
      .waitFor()
  }
)

await test(
  'MT-04',
  'Each row shows who booked whom (From → To) and the student',
  'Teacher and parent names with the arrow',
  async () => {
    await page.getByRole('columnheader', { name: /From → To/ }).waitFor()
    const text = await rowsLocator().first().innerText()
    assert(
      /Priya Venkatesh/.test(text) && /Lakshmi Narayanan/.test(text),
      `row text: ${text.replace(/\s+/g, ' ')}`
    )
    assert(/Kavin/.test(text), 'student name missing')
    const label = await rowsLocator()
      .first()
      .locator('[aria-label*="booked with"]')
      .getAttribute('aria-label')
    assert(/booked with/.test(label ?? ''), 'from/to aria label missing')
  }
)

await test(
  'MT-05',
  'Coming up card filters to scheduled meetings in the URL',
  'when=upcoming and only Scheduled rows',
  async () => {
    await page.getByRole('button', { name: /Coming up/ }).click()
    await page.waitForURL(/when=upcoming/)
    await page.waitForTimeout(800)
    const statuses = await rowsLocator().allInnerTexts()
    assert(
      statuses.length > 0 && statuses.every((t) => t.includes('Scheduled')),
      'non-scheduled row shown'
    )
    await page.getByRole('button', { name: /Coming up/ }).click()
    await page.waitForURL((url) => !url.search.includes('when='))
  }
)

await test(
  'MT-06',
  'Status filter (Combobox) shows only cancelled meetings',
  'status=cancelled, Cancelled badges',
  async () => {
    await page.getByRole('combobox', { name: 'Filter by status' }).click()
    await page.getByRole('option', { name: 'Cancelled' }).click()
    await page.waitForURL(/status=cancelled/)
    await page.waitForTimeout(800)
    const texts = await rowsLocator().allInnerTexts()
    assert(texts.length > 0 && texts.every((t) => t.includes('Cancelled')), 'other status shown')
  }
)

await test(
  'MT-07',
  'Booked-by filter shows meetings booked by parents',
  'scheduled_by=parent, parent in the From column',
  async () => {
    await page.goto(`${BASE}/meetings?page=1`)
    await page.getByRole('combobox', { name: 'Filter by who booked' }).click()
    await page.getByRole('option', { name: 'Booked by a parent' }).click()
    await page.waitForURL(/scheduled_by=parent/)
    await page.waitForTimeout(800)
    const labels = await rowsLocator()
      .locator('[aria-label*="booked with"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
    assert(labels.length > 0 && labels.every((l) => l.startsWith('Lakshmi')), labels.join(' | '))
  }
)

await test(
  'MT-08',
  'Search by topic narrows the list',
  'search=Reading in the URL, one matching row',
  async () => {
    await page.goto(`${BASE}/meetings?page=1`)
    await page
      .getByRole('searchbox', { name: 'Search meetings' })
      .or(page.getByLabel('Search meetings'))
      .first()
      .fill('Reading')
    await page.waitForURL(/search=Reading/)
    await page.waitForTimeout(800)
    const texts = await rowsLocator().allInnerTexts()
    assert(texts.length >= 1 && texts.every((t) => t.includes('Reading')), texts.join(' | '))
  }
)

await test(
  'MT-09',
  'A search with no match shows the empty state and Clear filters resets',
  'Empty state, then the full list',
  async () => {
    await page.getByLabel('Search meetings').first().fill('zzzz-no-such-meeting')
    await page.getByText('No meetings match these filters').waitFor()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await page.waitForURL((url) => !url.search.includes('search='))
    await rowsLocator().first().waitFor()
  }
)

await test('MT-10', 'Sorting by Status updates the URL', 'sort=status in the URL', async () => {
  await page.getByRole('button', { name: 'Sort by Status' }).click()
  await page.waitForURL(/sort=status/)
})

await test(
  'MT-11',
  'Opening a completed meeting shows from/to, timing and the call log',
  'Sheet with 2 call-log rows',
  async () => {
    await page.goto(`${BASE}/meetings?page=1&meeting=${completed.id}`)
    const sheet = page.getByRole('dialog')
    await sheet.getByText('From and to').waitFor()
    await sheet.getByText('Booked by', { exact: true }).waitFor()
    await sheet.getByText('Booked with', { exact: true }).waitFor()
    await sheet.getByText('Completed').first().waitFor()
    await sheet.getByText('Call log').waitFor()
    const items = await sheet.locator('section:has(h3:text("Call log")) li').count()
    assert(items === 2, `call log rows: ${items}`)
  }
)

await test(
  'MT-12',
  'Escape closes the sheet and removes it from the URL',
  'No dialog, no meeting= in URL',
  async () => {
    await page.keyboard.press('Escape')
    await page.waitForURL((url) => !url.search.includes('meeting='))
    await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 5000 })
  }
)

await test(
  'MT-13',
  'A cancelled meeting shows who cancelled and why',
  'Cancelled block with the reason',
  async () => {
    await page.goto(`${BASE}/meetings?page=1&meeting=${cancelled.id}`)
    const sheet = page.getByRole('dialog')
    await sheet.getByText(cancelled.cancel_reason, { exact: false }).waitFor()
    await sheet.getByText('Nobody has joined this call.').waitFor()
  }
)

await test(
  'MT-14',
  'Clicking a row opens the meeting sheet',
  'meeting= in the URL and the sheet title',
  async () => {
    await page.goto(`${BASE}/meetings?page=1`)
    await rowsLocator().first().click()
    await page.waitForURL(/meeting=\d+/)
    await page.getByRole('dialog').getByText('From and to').waitFor()
    await page.keyboard.press('Escape')
  }
)

await test(
  'MT-15',
  'Bad URL values fall back instead of breaking the page',
  'Page loads with defaults',
  async () => {
    await page.goto(`${BASE}/meetings?page=-4&status=bogus&sort=teacher&when=never&meeting=abc`)
    await page.getByRole('heading', { name: 'Meetings', level: 1 }).waitFor()
    await rowsLocator().first().waitFor()
    assert(!(await page.getByText(/something went wrong/i).count()), 'error page shown')
  }
)

await test(
  'MT-16',
  'Parents page loads at /guardians?page=1',
  'Heading, cards and parent rows',
  async () => {
    await page.goto(`${BASE}/guardians?page=1`)
    await page.getByRole('heading', { name: 'Parents', level: 1 }).waitFor()
    await rowsLocator().first().waitFor()
  }
)

await test(
  'MT-17',
  'A parent’s sheet lists their video meetings with from → to',
  'Video meetings block with QA meetings',
  async () => {
    await page.getByLabel('Search parents').first().fill('9000000005')
    await page.waitForURL(/search=/)
    await page.waitForTimeout(800)
    await rowsLocator().first().click()
    const sheet = page.getByRole('dialog')
    await sheet.getByText('Video meetings').waitFor()
    await sheet.getByText(/QA: /).first().waitFor()
    await sheet.locator('[aria-label*="booked with"]').first().waitFor()
  }
)

await test(
  'MT-18',
  'Clicking a meeting in the parent sheet opens it on the Meetings page',
  'URL /meetings?meeting=…',
  async () => {
    await page.getByRole('dialog').getByText(/QA: /).first().click()
    await page.waitForURL(/\/meetings\?.*meeting=\d+/)
    await page.getByRole('dialog').getByText('From and to').waitFor()
  }
)

await test(
  'MT-19',
  'Refresh shortcut (Alt+R) keeps the page working',
  'Rows still shown',
  async () => {
    await page.goto(`${BASE}/meetings?page=1`)
    await rowsLocator().first().waitFor()
    await page.keyboard.press('Alt+r')
    await page.waitForTimeout(800)
    await rowsLocator().first().waitFor()
  }
)

await test(
  'MT-20',
  'Dark mode renders the Meetings page from the theme tokens',
  'Body background changes, rows visible',
  async () => {
    const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    await page.keyboard.press('Alt+t')
    await page.waitForTimeout(500)
    const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    assert(before !== after, 'theme did not change')
    await rowsLocator().first().waitFor()
    await page.screenshot({ path: path.join(SHOTS, 'MT-20-dark.png') })
    await page.keyboard.press('Alt+t')
  }
)

const adminState = await admin.context.storageState()
await admin.context.close()

const phone = {
  context: await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: adminState,
  }),
}
page = await phone.context.newPage()
await test(
  'MT-21',
  'Phone width: meetings show as cards with no sideways scroll',
  'Cards, scrollWidth ≤ viewport',
  async () => {
    await page.goto(`${BASE}/meetings?page=1`)
    await page.getByRole('heading', { name: 'Meetings', level: 1 }).waitFor()
    await page.getByText(/QA: /).filter({ visible: true }).first().waitFor()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    assert(overflow <= 0, `page scrolls sideways by ${overflow}px`)
  }
)
await test(
  'MT-22',
  'Phone width: the meeting sheet fits the screen',
  'Sheet opens, no sideways scroll',
  async () => {
    await page.getByText(/QA: /).filter({ visible: true }).first().click()
    await page.getByRole('dialog').getByText('From and to').waitFor()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    assert(overflow <= 0, `page scrolls sideways by ${overflow}px`)
  }
)
await phone.context.close()

const tablet = {
  context: await browser.newContext({
    viewport: { width: 820, height: 1180 },
    storageState: adminState,
  }),
}
page = await tablet.context.newPage()
await test(
  'MT-23',
  'Tablet width: full names wrap and nothing scrolls sideways',
  'Full teacher and parent names visible, no overflow',
  async () => {
    await page.goto(`${BASE}/meetings?page=1`)
    await rowsLocator().first().waitFor()
    await page.getByText('Priya Venkatesh').filter({ visible: true }).first().waitFor()
    await page.getByText('Lakshmi Narayanan').filter({ visible: true }).first().waitFor()
    const clipped = await rowsLocator()
      .first()
      .locator('[aria-label*="booked with"] span.font-semibold')
      .evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).length)
    assert(clipped === 0, `${clipped} names are cut off`)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    assert(overflow <= 0, `page scrolls sideways by ${overflow}px`)
  }
)
await tablet.context.close()

const transport = await signIn('9000000003')
page = transport.page
await test(
  'MT-24',
  'Transport in-charge (no meetings.view) does not see Meetings',
  'No sidebar link; no Video meetings in parent sheet',
  async () => {
    await page.locator('a[href="/guardians"]').filter({ visible: true }).first().waitFor()
    assert(!(await page.locator('a[href="/meetings"]').count()), 'Meetings link visible')
    await page.goto(`${BASE}/guardians?page=1`)
    await rowsLocator().first().click()
    await page.getByRole('dialog').getByText('Children in this school').waitFor()
    assert(
      !(await page.getByRole('dialog').getByText('Video meetings').count()),
      'Video meetings shown'
    )
  }
)
await transport.context.close()

const principal = await signIn('9000000001')
page = principal.page
await test(
  'MT-25',
  'Principal sees the Meetings page (meetings.view)',
  'Link visible and list loads',
  async () => {
    await page.locator('a[href="/meetings"]').filter({ visible: true }).first().click()
    await rowsLocator().first().waitFor()
  }
)
await principal.context.close()

await browser.close()
fs.writeFileSync(path.join(OUT, 'meetings-ui.json'), JSON.stringify({ day: DAY, results }, null, 2))
const failed = results.filter((row) => row.status === 'Fail').length
console.log(`\n${results.length - failed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
