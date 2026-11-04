import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const BACKEND = process.env.E2E_BACKEND_DIR ?? 'C:/Users/DELL/Telematics'
const require = createRequire(`${BACKEND}/package.json`)
require('dotenv').config({ path: `${BACKEND}/.env` })
const pg = require('pg')

const BASE = process.env.E2E_API_URL ?? 'http://localhost:3000/api/v1'
const DAY = process.env.E2E_DAY ?? 'Day 8'
const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const OUT = path.join(ROOT, 'results', 'meetings-api.json')
fs.mkdirSync(path.dirname(OUT), { recursive: true })
const results = []
const db = new pg.Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})

const EXPECTED = {
  'API health endpoint responds': '200',
  'Mobile Swagger lists teacher and parent meeting routes':
    'Join and book routes in /api/docs/mobile-json',
  'Admin Swagger lists read-only meeting routes only': '/admin/meetings listed, no join route',
  'Admin, teacher, parent, transport and driver sign in': 'Every sign-in returns a token',
  'Admin meetings list returns the paginated shape':
    '200 with items, total, page, limit, total_pages, has_next',
  'Admin meeting insights return counts':
    '200 with today, upcoming, live, completed, missed, cancelled',
  'Parent sees a linked child': '200 with at least one child',
  'Parent gets the child’s teachers, class teacher first': '200, class teacher first',
  'Teacher gets the student’s parents who have the app': '200 including the parent',
  'Teacher books a meeting with the parent (teacher → parent)':
    '201 scheduled, from = teacher, to = parent',
  'Parent sees the meeting in upcoming, joinable now': 'Listed with can_join true',
  'Admin list shows the meeting with from → to and student (filters when=today, scheduled_by=teacher)':
    'Row with from, to and student names',
  'Admin list filters by parent (guardian_id) for the Parents page': 'Only that parent’s meetings',
  'Admin search by topic finds the meeting': 'Meeting in the results',
  'Parent joins: Agora app_id, channel, uid and 007 token returned; meeting goes live':
    '200 with Agora app_id, channel, uid, 007 token; status live',
  'Teacher joins the same channel': '200, same channel, teacher uid',
  'Teacher renews the Agora token without a new call-log row': '200 with a new token',
  'Parent leaves the call; meeting stays live': '200, status live',
  'Admin detail shows the call log: 2 joins, parent left': '2 call-log rows, parent has left_at',
  'Teacher ends the call: completed, every log row closed': '200 completed with call_minutes',
  'Call log has no open rows after the end': 'Every row has left_at',
  'Parent books a meeting with the class teacher (parent → teacher)':
    '201, from = parent, to = teacher',
  'Teacher cancels with a reason': '200 cancelled with cancelled_by and reason',
  'Two more upcoming meetings booked (one each way)': '201 and 201',
  'Teacher booking without parent_user_id picks the primary parent':
    'Parent is the primary guardian',
  'Parent got a MEETING_SCHEDULED notification': 'MEETING_SCHEDULED in the parent inbox',
  'Teacher got MEETING_SCHEDULED when the parent booked': 'MEETING_SCHEDULED in the teacher inbox',
  'Parent got MEETING_CANCELLED when the teacher cancelled':
    'MEETING_CANCELLED in the parent inbox',
  'Teacher past list has the completed and cancelled meetings': 'Both meetings in scope=past',
  'Insights count completed, cancelled and upcoming': 'completed ≥ 1, cancelled ≥ 1, upcoming ≥ 2',
  'Teacher cannot book about a student outside their sections': '403 NOT_YOUR_SECTION',
  'Reminder job sends MEETING_REMINDER 10 minutes before':
    'reminder_sent_at set and MEETING_REMINDER rows',
  'Expiry job marks an unjoined past meeting as missed': 'status missed',
}

let lastCall = { method: 'GET', path: '' }
const endpointOf = (value) => value.replace(/\?.*$/, '').replace(/\/\d+(?=\/|$)/g, '/:id')

function record(type, name, ok, detail = '', expected) {
  results.push({
    day: DAY,
    id: `API-VM-${String(results.length + 1).padStart(2, '0')}`,
    module: 'Meetings',
    type,
    method: lastCall.method,
    endpoint: endpointOf(lastCall.path),
    scenario: name,
    expected: expected ?? EXPECTED[name] ?? 'As described',
    status: ok ? 'Pass' : 'Fail',
    actual: detail || (ok ? (expected ?? EXPECTED[name] ?? 'As expected') : 'Not as expected'),
  })
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${type}] ${name}${detail ? `  -- ${detail}` : ''}`)
}

async function call(method, path, { token, body, query } = {}) {
  lastCall = { method, path }
  const url = new URL(BASE + path)
  Object.entries(query ?? {}).forEach(
    ([k, v]) => v !== undefined && url.searchParams.set(k, String(v))
  )
  const res = await fetch(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try {
    json = await res.json()
  } catch {}
  return { status: res.status, body: json, data: json?.data }
}

async function login(mobile, app) {
  const req = await call('POST', '/auth/otp/request', { body: { mobile, app } })
  if (req.status !== 200 && req.status !== 201)
    throw new Error(`OTP request ${mobile}: ${req.status} ${JSON.stringify(req.body)}`)
  const res = await call('POST', '/auth/otp/verify', {
    body: { mobile, otp: '123456', client: { app, platform: 'android', device_name: 'QA runner' } },
  })
  if (!res.data?.access_token)
    throw new Error(`Login ${mobile}: ${res.status} ${JSON.stringify(res.body)}`)
  return { token: res.data.access_token, user: res.data.user }
}

const expectStatus = (type, name, res, status, code, field) => {
  const okStatus = res.status === status
  const okCode = code ? res.body?.error === code : true
  const okField = field ? (res.body?.errors ?? []).some((e) => e.field === field) : true
  record(
    type,
    name,
    okStatus && okCode && okField,
    `${res.status}${res.body?.error ? ` ${res.body.error}` : ''}${res.body?.message && res.status >= 400 ? `: ${res.body.message}` : ''}`,
    `${status}${code ? ` ${code}` : ''}${field ? ` on ${field}` : ''}`
  )
}

const inMinutes = (m) => {
  const d = new Date(Date.now() + m * 60_000)
  const ist = new Date(d.getTime() + 330 * 60_000)
  return ist.toISOString().slice(0, 19) + '+05:30'
}

async function main() {
  await db.connect()
  await db.query(
    `DELETE FROM meeting_call_logs WHERE meeting_id IN (SELECT id FROM meetings WHERE title LIKE 'QA:%')`
  )
  await db.query(`DELETE FROM meetings WHERE title LIKE 'QA:%'`)

  lastCall = { method: 'GET', path: '/health' }
  const health = await fetch(BASE.replace('/v1', '') + '/health')
  record('Smoke', 'API health endpoint responds', health.status === 200, `HTTP ${health.status}`)

  lastCall = { method: 'GET', path: '/api/docs/mobile-json' }
  const docsMobile = await (await fetch(BASE.replace('/api/v1', '/api/docs/mobile-json'))).json()
  const docsAdmin = await (await fetch(BASE.replace('/api/v1', '/api/docs/admin-json'))).json()
  record(
    'Smoke',
    'Mobile Swagger lists teacher and parent meeting routes',
    Boolean(
      docsMobile.paths['/api/v1/mobile/teacher/meetings/{meetingId}/join'] &&
      docsMobile.paths['/api/v1/mobile/parent/children/{id}/meetings']
    )
  )
  lastCall = { method: 'GET', path: '/api/docs/admin-json' }
  record(
    'Smoke',
    'Admin Swagger lists read-only meeting routes only',
    Boolean(docsAdmin.paths['/api/v1/admin/meetings']) &&
      !Object.keys(docsAdmin.paths).some((p) => p.includes('/meetings') && p.includes('join'))
  )

  const admin = await login('9876543210', 'admin')
  const teacher = await login('9000000004', 'mobile')
  const parent = await login('9000000005', 'mobile')
  const transport = await login('9000000003', 'admin')
  const driver = await login('9000000007', 'mobile')
  record('Smoke', 'Admin, teacher, parent, transport and driver sign in', true)

  const list0 = await call('GET', '/admin/meetings', { token: admin.token })
  record(
    'Smoke',
    'Admin meetings list returns the paginated shape',
    list0.status === 200 &&
      ['items', 'total', 'page', 'limit', 'total_pages', 'has_next'].every(
        (k) => k in (list0.data ?? {})
      ),
    `HTTP ${list0.status}`
  )
  const ins0 = await call('GET', '/admin/meetings/insights', { token: admin.token })
  record(
    'Smoke',
    'Admin meeting insights return counts',
    ins0.status === 200 && typeof ins0.data?.today === 'number',
    `HTTP ${ins0.status}`
  )

  const children = await call('GET', '/mobile/parent/children', { token: parent.token })
  const child = children.data?.[0]
  record(
    'Functional',
    'Parent sees a linked child',
    Boolean(child),
    child ? `${child.full_name} ${child.class_name}-${child.section_name}` : ''
  )

  const teachers = await call('GET', `/mobile/parent/children/${child.id}/teachers`, {
    token: parent.token,
  })
  const priya = teachers.data?.find((t) => t.id === teacher.user.id)
  record(
    'Functional',
    'Parent gets the child’s teachers, class teacher first',
    teachers.status === 200 && Boolean(priya) && teachers.data[0].is_class_teacher === true,
    `${teachers.data?.length ?? 0} teachers`
  )

  const parents = await call('GET', `/mobile/teacher/students/${child.id}/parents`, {
    token: teacher.token,
  })
  record(
    'Functional',
    'Teacher gets the student’s parents who have the app',
    parents.status === 200 && parents.data?.some((p) => p.id === parent.user.id),
    `${parents.data?.length ?? 0} parents`
  )

  const m1 = await call('POST', '/mobile/teacher/meetings', {
    token: teacher.token,
    body: {
      student_id: child.id,
      parent_user_id: parent.user.id,
      title: 'QA: Maths progress',
      agenda: 'Unit test marks and homework',
      scheduled_at: inMinutes(2),
      duration_minutes: 15,
    },
  })
  record(
    'Functional',
    'Teacher books a meeting with the parent (teacher → parent)',
    m1.status === 201 &&
      m1.data?.status === 'scheduled' &&
      m1.data.from.id === teacher.user.id &&
      m1.data.to.id === parent.user.id,
    `HTTP ${m1.status} id=${m1.data?.id} ${m1.data?.from?.name} → ${m1.data?.to?.name}`
  )
  const meetingId = m1.data.id

  const pList = await call('GET', '/mobile/parent/meetings', { token: parent.token })
  const pItem = pList.data?.items?.find((m) => m.id === meetingId)
  record(
    'Functional',
    'Parent sees the meeting in upcoming, joinable now',
    Boolean(pItem?.can_join),
    `can_join=${pItem?.can_join}`
  )

  const aList = await call('GET', '/admin/meetings', {
    token: admin.token,
    query: { when: 'today', scheduled_by: 'teacher' },
  })
  const aItem = aList.data?.items?.find((m) => m.id === meetingId)
  record(
    'Functional',
    'Admin list shows the meeting with from → to and student (filters when=today, scheduled_by=teacher)',
    Boolean(aItem) && aItem.from.name && aItem.to.name && aItem.student.name,
    aItem ? `${aItem.from.name} → ${aItem.to.name} about ${aItem.student.name}` : 'missing'
  )

  const guardians = await call('GET', '/admin/guardians', {
    token: admin.token,
    query: { search: '9000000005' },
  })
  const guardianId = guardians.data?.items?.[0]?.id
  const gList = await call('GET', '/admin/meetings', {
    token: admin.token,
    query: { guardian_id: guardianId },
  })
  record(
    'Functional',
    'Admin list filters by parent (guardian_id) for the Parents page',
    gList.status === 200 &&
      gList.data.items.some((m) => m.id === meetingId) &&
      gList.data.items.every((m) => m.parent.id === parent.user.id),
    `guardian ${guardianId}: ${gList.data?.total} meetings`
  )

  const search = await call('GET', '/admin/meetings', {
    token: admin.token,
    query: { search: 'QA: Maths' },
  })
  record(
    'Functional',
    'Admin search by topic finds the meeting',
    search.data?.items?.some((m) => m.id === meetingId)
  )

  const pJoin = await call('POST', `/mobile/parent/meetings/${meetingId}/join`, {
    token: parent.token,
    body: { platform: 'android' },
  })
  record(
    'Functional',
    'Parent joins: Agora app_id, channel, uid and 007 token returned; meeting goes live',
    pJoin.status === 200 &&
      pJoin.data.provider === 'agora' &&
      pJoin.data.token.startsWith('007') &&
      pJoin.data.uid === parent.user.id &&
      pJoin.data.meeting.status === 'live',
    `HTTP ${pJoin.status} channel=${pJoin.data?.channel_name}`
  )

  const tJoin = await call('POST', `/mobile/teacher/meetings/${meetingId}/join`, {
    token: teacher.token,
    body: { platform: 'ios' },
  })
  record(
    'Functional',
    'Teacher joins the same channel',
    tJoin.status === 200 &&
      tJoin.data.channel_name === pJoin.data.channel_name &&
      tJoin.data.uid === teacher.user.id,
    `HTTP ${tJoin.status}`
  )

  const renew = await call('POST', `/mobile/teacher/meetings/${meetingId}/token`, {
    token: teacher.token,
  })
  record(
    'Functional',
    'Teacher renews the Agora token without a new call-log row',
    renew.status === 200 && renew.data.token.startsWith('007'),
    `HTTP ${renew.status}`
  )

  const leave = await call('POST', `/mobile/parent/meetings/${meetingId}/leave`, {
    token: parent.token,
  })
  record(
    'Functional',
    'Parent leaves the call; meeting stays live',
    leave.status === 200 && leave.data.status === 'live',
    `HTTP ${leave.status}`
  )

  const detailLive = await call('GET', `/admin/meetings/${meetingId}`, { token: admin.token })
  record(
    'Functional',
    'Admin detail shows the call log: 2 joins, parent left',
    detailLive.data?.call_log?.length === 2 &&
      detailLive.data.call_log.some((c) => c.party === 'parent' && c.left_at),
    `${detailLive.data?.call_log?.length} log rows`
  )

  const end = await call('POST', `/mobile/teacher/meetings/${meetingId}/end`, {
    token: teacher.token,
  })
  record(
    'Functional',
    'Teacher ends the call: completed, every log row closed',
    end.status === 200 &&
      end.data.status === 'completed' &&
      typeof end.data.call_minutes === 'number',
    `HTTP ${end.status} status=${end.data?.status}`
  )
  const detailDone = await call('GET', `/admin/meetings/${meetingId}`, { token: admin.token })
  record(
    'Functional',
    'Call log has no open rows after the end',
    detailDone.data?.call_log?.every((c) => c.left_at)
  )

  expectStatus(
    'Functional',
    'Joining an ended meeting is refused',
    await call('POST', `/mobile/teacher/meetings/${meetingId}/join`, {
      token: teacher.token,
      body: {},
    }),
    409,
    'MEETING_ENDED'
  )

  const tomorrow = inMinutes(24 * 60 + 90)
  const m2 = await call('POST', `/mobile/parent/children/${child.id}/meetings`, {
    token: parent.token,
    body: {
      teacher_user_id: teacher.user.id,
      title: 'QA: Reading habits',
      scheduled_at: tomorrow,
      duration_minutes: 20,
    },
  })
  record(
    'Functional',
    'Parent books a meeting with the class teacher (parent → teacher)',
    m2.status === 201 &&
      m2.data.scheduled_by === 'parent' &&
      m2.data.from.id === parent.user.id &&
      m2.data.to.id === teacher.user.id,
    `HTTP ${m2.status} ${m2.data?.from?.name} → ${m2.data?.to?.name}`
  )

  expectStatus(
    'Functional',
    'Booking the teacher at a clashing time is refused',
    await call('POST', '/mobile/teacher/meetings', {
      token: teacher.token,
      body: {
        student_id: child.id,
        title: 'QA: Clash',
        scheduled_at: tomorrow,
        duration_minutes: 15,
      },
    }),
    409,
    'MEETING_CLASH'
  )
  expectStatus(
    'Functional',
    'Joining tomorrow’s meeting today is refused',
    await call('POST', `/mobile/parent/meetings/${m2.data.id}/join`, {
      token: parent.token,
      body: {},
    }),
    409,
    'MEETING_NOT_OPEN'
  )
  expectStatus(
    'Functional',
    'Ending a meeting nobody joined is refused',
    await call('POST', `/mobile/teacher/meetings/${m2.data.id}/end`, { token: teacher.token }),
    409,
    'MEETING_NOT_LIVE'
  )

  const cancel = await call('POST', `/mobile/teacher/meetings/${m2.data.id}/cancel`, {
    token: teacher.token,
    body: { reason: 'Staff meeting that evening' },
  })
  record(
    'Functional',
    'Teacher cancels with a reason',
    cancel.status === 200 &&
      cancel.data.status === 'cancelled' &&
      cancel.data.cancelled_by?.id === teacher.user.id &&
      cancel.data.cancel_reason === 'Staff meeting that evening',
    `HTTP ${cancel.status}`
  )
  expectStatus(
    'Functional',
    'Cancelling twice is refused',
    await call('POST', `/mobile/teacher/meetings/${m2.data.id}/cancel`, {
      token: teacher.token,
      body: {},
    }),
    409,
    'MEETING_NOT_CANCELLABLE'
  )

  const m3 = await call('POST', `/mobile/parent/children/${child.id}/meetings`, {
    token: parent.token,
    body: {
      teacher_user_id: teacher.user.id,
      title: 'QA: Sports day',
      scheduled_at: inMinutes(3 * 24 * 60),
      duration_minutes: 15,
    },
  })
  const m4 = await call('POST', '/mobile/teacher/meetings', {
    token: teacher.token,
    body: {
      student_id: child.id,
      title: 'QA: Science project',
      scheduled_at: inMinutes(4 * 24 * 60),
      duration_minutes: 30,
    },
  })
  record(
    'Functional',
    'Two more upcoming meetings booked (one each way)',
    m3.status === 201 && m4.status === 201,
    `HTTP ${m3.status}/${m4.status}`
  )
  record(
    'Functional',
    'Teacher booking without parent_user_id picks the primary parent',
    m4.data?.parent?.id === parent.user.id
  )

  const pNotes = await call('GET', '/me/notifications', {
    token: parent.token,
    query: { limit: 30 },
  })
  const tNotes = await call('GET', '/me/notifications', {
    token: teacher.token,
    query: { limit: 30 },
  })
  record(
    'Functional',
    'Parent got a MEETING_SCHEDULED notification',
    pNotes.data?.items?.some((n) => n.template_code === 'MEETING_SCHEDULED')
  )
  record(
    'Functional',
    'Teacher got MEETING_SCHEDULED when the parent booked',
    tNotes.data?.items?.some((n) => n.template_code === 'MEETING_SCHEDULED')
  )
  record(
    'Functional',
    'Parent got MEETING_CANCELLED when the teacher cancelled',
    pNotes.data?.items?.some((n) => n.template_code === 'MEETING_CANCELLED')
  )

  const tPast = await call('GET', '/mobile/teacher/meetings', {
    token: teacher.token,
    query: { scope: 'past' },
  })
  record(
    'Functional',
    'Teacher past list has the completed and cancelled meetings',
    [meetingId, m2.data.id].every((id) => tPast.data?.items?.some((m) => m.id === id))
  )

  const ins1 = await call('GET', '/admin/meetings/insights', { token: admin.token })
  record(
    'Functional',
    'Insights count completed, cancelled and upcoming',
    ins1.data.completed >= 1 && ins1.data.cancelled >= 1 && ins1.data.upcoming >= 2,
    JSON.stringify(ins1.data)
  )

  const valid = { student_id: child.id, title: 'QA: Valid', scheduled_at: inMinutes(5 * 24 * 60) }
  const tPost = (body) => call('POST', '/mobile/teacher/meetings', { token: teacher.token, body })
  expectStatus(
    'Validation',
    'Missing title',
    await tPost({ ...valid, title: undefined }),
    400,
    'VALIDATION_FAILED',
    'title'
  )
  expectStatus(
    'Validation',
    'Blank title (spaces only)',
    await tPost({ ...valid, title: '   ' }),
    400,
    'VALIDATION_FAILED',
    'title'
  )
  expectStatus(
    'Validation',
    'Title longer than 150 characters',
    await tPost({ ...valid, title: 'x'.repeat(151) }),
    400,
    'VALIDATION_FAILED',
    'title'
  )
  expectStatus(
    'Validation',
    'Agenda longer than 500 characters',
    await tPost({ ...valid, agenda: 'x'.repeat(501) }),
    400,
    'VALIDATION_FAILED',
    'agenda'
  )
  expectStatus(
    'Validation',
    'scheduled_at without a time zone',
    await tPost({ ...valid, scheduled_at: '2026-11-20T16:30:00' }),
    400,
    'VALIDATION_FAILED',
    'scheduled_at'
  )
  expectStatus(
    'Validation',
    'scheduled_at that is not a date',
    await tPost({ ...valid, scheduled_at: 'tomorrow 4pm' }),
    400,
    'VALIDATION_FAILED',
    'scheduled_at'
  )
  expectStatus(
    'Validation',
    'scheduled_at in the past',
    await tPost({ ...valid, scheduled_at: inMinutes(-60) }),
    400,
    'VALIDATION_FAILED',
    'scheduled_at'
  )
  expectStatus(
    'Validation',
    'scheduled_at more than 60 days ahead',
    await tPost({ ...valid, scheduled_at: inMinutes(61 * 24 * 60) }),
    400,
    'VALIDATION_FAILED',
    'scheduled_at'
  )
  expectStatus(
    'Validation',
    'duration_minutes below 5',
    await tPost({ ...valid, duration_minutes: 3 }),
    400,
    'VALIDATION_FAILED',
    'duration_minutes'
  )
  expectStatus(
    'Validation',
    'duration_minutes above 60',
    await tPost({ ...valid, duration_minutes: 90 }),
    400,
    'VALIDATION_FAILED',
    'duration_minutes'
  )
  expectStatus(
    'Validation',
    'duration_minutes as text',
    await tPost({ ...valid, duration_minutes: 'ten' }),
    400,
    'VALIDATION_FAILED',
    'duration_minutes'
  )
  expectStatus(
    'Validation',
    'Unknown field is rejected',
    await tPost({ ...valid, room: 'A1' }),
    400,
    'VALIDATION_FAILED'
  )
  expectStatus(
    'Validation',
    'student_id missing',
    await tPost({ ...valid, student_id: undefined }),
    400,
    'VALIDATION_FAILED',
    'student_id'
  )
  expectStatus(
    'Validation',
    'parent_user_id not a parent of the student',
    await tPost({ ...valid, parent_user_id: admin.user.id }),
    400,
    'VALIDATION_FAILED',
    'parent_user_id'
  )
  expectStatus(
    'Validation',
    'Parent books a person who does not teach the child',
    await call('POST', `/mobile/parent/children/${child.id}/meetings`, {
      token: parent.token,
      body: { teacher_user_id: transport.user.id, title: 'QA', scheduled_at: inMinutes(600) },
    }),
    400,
    'VALIDATION_FAILED',
    'teacher_user_id'
  )
  expectStatus(
    'Validation',
    'Parent books for a child that is not theirs',
    await call('POST', '/mobile/parent/children/999999/meetings', {
      token: parent.token,
      body: { teacher_user_id: teacher.user.id, title: 'QA', scheduled_at: inMinutes(600) },
    }),
    404,
    'CHILD_NOT_FOUND'
  )
  expectStatus(
    'Validation',
    'Cancel reason longer than 255 characters',
    await call('POST', `/mobile/teacher/meetings/${m4.data.id}/cancel`, {
      token: teacher.token,
      body: { reason: 'x'.repeat(256) },
    }),
    400,
    'VALIDATION_FAILED',
    'reason'
  )
  expectStatus(
    'Validation',
    'Join with an unknown platform',
    await call('POST', `/mobile/teacher/meetings/${m4.data.id}/join`, {
      token: teacher.token,
      body: { platform: 'windows' },
    }),
    400,
    'VALIDATION_FAILED',
    'platform'
  )
  expectStatus(
    'Validation',
    'Mobile list with an unknown scope',
    await call('GET', '/mobile/teacher/meetings', {
      token: teacher.token,
      query: { scope: 'soon' },
    }),
    400,
    'VALIDATION_FAILED',
    'scope'
  )
  expectStatus(
    'Validation',
    'Admin list with an unknown sort',
    await call('GET', '/admin/meetings', { token: admin.token, query: { sort: 'teacher' } }),
    400,
    'INVALID_SORT'
  )
  expectStatus(
    'Validation',
    'Admin list with an unknown status',
    await call('GET', '/admin/meetings', { token: admin.token, query: { status: 'done' } }),
    400,
    'VALIDATION_FAILED',
    'status'
  )
  expectStatus(
    'Validation',
    'Admin list with a bad date_from',
    await call('GET', '/admin/meetings', {
      token: admin.token,
      query: { date_from: '11/04/2026' },
    }),
    400,
    'VALIDATION_FAILED',
    'date_from'
  )
  expectStatus(
    'Validation',
    'Admin list with an unknown query parameter',
    await call('GET', '/admin/meetings', { token: admin.token, query: { teacher: 'Priya' } }),
    400,
    'VALIDATION_FAILED'
  )
  expectStatus(
    'Validation',
    'Admin list with limit 500',
    await call('GET', '/admin/meetings', { token: admin.token, query: { limit: 500 } }),
    400,
    'VALIDATION_FAILED',
    'limit'
  )
  expectStatus(
    'Validation',
    'Admin detail of a meeting that does not exist',
    await call('GET', '/admin/meetings/999999', { token: admin.token }),
    404,
    'MEETING_NOT_FOUND'
  )
  expectStatus(
    'Validation',
    'Admin detail with a non-numeric id',
    await call('GET', '/admin/meetings/abc', { token: admin.token }),
    400
  )

  expectStatus(
    'Security',
    'No token on the admin list',
    await call('GET', '/admin/meetings'),
    401,
    'TOKEN_MISSING'
  )
  expectStatus(
    'Security',
    'No token on the mobile list',
    await call('GET', '/mobile/parent/meetings'),
    401,
    'TOKEN_MISSING'
  )
  expectStatus(
    'Security',
    'Transport in-charge (no meetings.view) cannot read meetings',
    await call('GET', '/admin/meetings', { token: transport.token }),
    403,
    'FORBIDDEN'
  )
  expectStatus(
    'Security',
    'Parent cannot use teacher meeting routes',
    await call('GET', '/mobile/teacher/meetings', { token: parent.token }),
    403,
    'FORBIDDEN'
  )
  expectStatus(
    'Security',
    'Driver cannot use parent meeting routes',
    await call('GET', '/mobile/parent/meetings', { token: driver.token }),
    403,
    'FORBIDDEN'
  )
  expectStatus(
    'Security',
    'Teacher app token cannot read the admin list',
    await call('GET', '/admin/meetings', { token: teacher.token }),
    403,
    'FORBIDDEN'
  )
  expectStatus(
    'Security',
    'There is no admin route to join a call',
    await call('POST', `/admin/meetings/${m4.data.id}/join`, { token: admin.token }),
    404
  )

  const other = await login('9000000006', 'mobile')
  expectStatus(
    'Security',
    'Another parent cannot open this meeting',
    await call('GET', `/mobile/parent/meetings/${m4.data.id}`, { token: other.token }),
    404,
    'MEETING_NOT_FOUND'
  )
  expectStatus(
    'Security',
    'Another parent cannot join this meeting',
    await call('POST', `/mobile/parent/meetings/${m4.data.id}/join`, {
      token: other.token,
      body: {},
    }),
    404,
    'MEETING_NOT_FOUND'
  )
  expectStatus(
    'Security',
    'Another teacher cannot cancel this meeting',
    await call('POST', `/mobile/teacher/meetings/${m4.data.id}/cancel`, {
      token: other.token,
      body: {},
    }),
    404,
    'MEETING_NOT_FOUND'
  )

  const students = await call('GET', '/admin/students', {
    token: admin.token,
    query: { limit: 100 },
  })
  let foreign = null
  for (const s of students.data?.items ?? []) {
    const r = await call('GET', `/mobile/teacher/students/${s.id}/parents`, {
      token: teacher.token,
    })
    if (r.status === 403) {
      foreign = s.id
      break
    }
  }
  if (foreign) {
    expectStatus(
      'Security',
      'Teacher cannot book about a student outside their sections',
      await tPost({ ...valid, student_id: foreign }),
      403,
      'NOT_YOUR_SECTION'
    )
  } else {
    record(
      'Security',
      'Teacher cannot book about a student outside their sections',
      false,
      'no student outside the teacher’s sections found'
    )
  }

  const m5 = await call('POST', `/mobile/parent/children/${child.id}/meetings`, {
    token: parent.token,
    body: {
      teacher_user_id: teacher.user.id,
      title: 'QA: Reminder job',
      scheduled_at: inMinutes(7 * 24 * 60),
      duration_minutes: 15,
    },
  })
  const m6 = await call('POST', `/mobile/parent/children/${child.id}/meetings`, {
    token: parent.token,
    body: {
      teacher_user_id: teacher.user.id,
      title: 'QA: Expiry job',
      scheduled_at: inMinutes(8 * 24 * 60),
      duration_minutes: 15,
    },
  })
  await db.query(
    `UPDATE meetings SET scheduled_at = now() + interval '5 minutes', reminder_sent_at = NULL WHERE id = $1`,
    [m5.data.id]
  )
  await db.query(`UPDATE meetings SET scheduled_at = now() - interval '2 hours' WHERE id = $1`, [
    m6.data.id,
  ])
  lastCall = { method: 'CRON', path: 'meetings job (every minute)' }
  let reminded = false
  let missed = false
  for (let i = 0; i < 16 && !(reminded && missed); i++) {
    await new Promise((r) => setTimeout(r, 5000))
    const [a] = (
      await db.query('SELECT reminder_sent_at FROM meetings WHERE id = $1', [m5.data.id])
    ).rows
    const [b] = (await db.query('SELECT status FROM meetings WHERE id = $1', [m6.data.id])).rows
    reminded = Boolean(a.reminder_sent_at)
    missed = b.status === 'missed'
  }
  const [reminderRows] = (
    await db.query(
      `SELECT count(*)::int AS n FROM notifications WHERE template_code = 'MEETING_REMINDER' AND created_at > now() - interval '3 minutes'`
    )
  ).rows
  record(
    'Regression',
    'Reminder job sends MEETING_REMINDER 10 minutes before',
    reminded && reminderRows.n >= 2,
    `reminder_sent=${reminded}, rows=${reminderRows.n}`
  )
  record('Regression', 'Expiry job marks an unjoined past meeting as missed', missed)
  await db.query(
    `UPDATE meetings SET status = 'cancelled', cancel_reason = 'QA reminder test' WHERE id = $1`,
    [m5.data.id]
  )

  await db.end()
  save()
  const failed = results.filter((r) => r.status === 'Fail').length
  console.log(
    `\n${results.length - failed}/${results.length} meeting API checks passed. Results: e2e/results/meetings-api.json`
  )
  process.exit(failed ? 1 : 0)
}

function save() {
  fs.writeFileSync(
    OUT,
    JSON.stringify({ run_at: new Date().toISOString(), api: BASE, day: DAY, results }, null, 2)
  )
}

main().catch(async (error) => {
  console.error('RUNNER ERROR', error)
  save()
  process.exit(1)
})
