import fs from 'node:fs'
import { createHmac } from 'node:crypto'
import http from 'node:http'
import { createRequire } from 'node:module'
import path from 'node:path'
import { io } from 'socket.io-client'

const BACKEND = process.env.E2E_BACKEND_DIR ?? 'C:/Users/DELL/Telematics'
const require = createRequire(`${BACKEND}/package.json`)
require('dotenv').config({ path: `${BACKEND}/.env` })
const pg = require('pg')

const API = process.env.E2E_API_URL ?? 'http://localhost:3000/api/v1'
const ORIGIN = new URL(API).origin
const DAY = process.env.E2E_DAY ?? 'Day 8'
const WEBHOOK_SECRET = process.env.E2E_AGORA_WEBHOOK_SECRET ?? 'agora-webhook-secret-for-tests'
const AGORA_MOCK_PORT = Number(process.env.E2E_AGORA_MOCK_PORT ?? 3999)
const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const OUT = path.join(ROOT, 'results', 'day8-api.json')
fs.mkdirSync(path.dirname(OUT), { recursive: true })

const db = new pg.Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})
const results = []
const counters = {}
let lastCall = { method: 'GET', path: '' }
const sockets = []

const kicks = []
const agoraMock = http.createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', () => {
    kicks.push({
      url: req.url,
      auth: req.headers.authorization,
      body: body ? JSON.parse(body) : null,
    })
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ status: 'success', id: 7700 + kicks.length }))
  })
})

const MODULES = { VM: 'Meetings', DY: 'Diary', AN: 'Announcements', CH: 'Chat', D8: 'Day 8 smoke' }

function record(prefix, type, scenario, ok, actual, expected) {
  counters[prefix] = (counters[prefix] ?? 0) + 1
  const id = `API-${prefix}-${String(counters[prefix]).padStart(2, '0')}`
  results.push({
    day: DAY,
    id,
    module: MODULES[prefix],
    type,
    method: lastCall.method,
    endpoint: lastCall.path.replace(/\?.*$/, '').replace(/\/\d+(?=\/|$)/g, '/:id'),
    scenario,
    expected: expected ?? 'As described',
    status: ok ? 'Pass' : 'Fail',
    actual: actual ?? (ok ? (expected ?? 'As expected') : 'Not as expected'),
  })
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(10)} [${type}] ${scenario}${actual ? `  -- ${actual}` : ''}`
  )
}

async function call(method, urlPath, { token, body, query, headers, raw } = {}) {
  lastCall = { method, path: urlPath }
  const url = new URL(API + urlPath)
  Object.entries(query ?? {}).forEach(
    ([k, v]) => v !== undefined && url.searchParams.set(k, String(v))
  )
  const res = await fetch(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  return { status: res.status, body: json, data: json?.data }
}

const describe = (res) =>
  `${res.status}${res.body?.error ? ` ${res.body.error}` : ''}${res.status >= 400 && res.body?.message ? `: ${res.body.message}` : ''}`

function expectStatus(prefix, type, scenario, res, status, code, field) {
  const ok =
    res.status === status &&
    (!code || res.body?.error === code) &&
    (!field || (res.body?.errors ?? []).some((e) => e.field === field))
  record(
    prefix,
    type,
    scenario,
    ok,
    describe(res),
    `${status}${code ? ` ${code}` : ''}${field ? ` on ${field}` : ''}`
  )
  return res
}

async function login(mobile, app) {
  const req = await call('POST', '/auth/otp/request', { body: { mobile, app } })
  if (req.status !== 200 && req.status !== 201) throw new Error(`OTP ${mobile}: ${describe(req)}`)
  const res = await call('POST', '/auth/otp/verify', {
    body: {
      mobile,
      otp: '123456',
      client: { app, platform: 'android', device_name: 'Day 8 runner' },
    },
  })
  if (!res.data?.access_token) throw new Error(`Login ${mobile}: ${describe(res)}`)
  return { token: res.data.access_token, user: res.data.user }
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(`${ORIGIN}/comm`, {
      auth: { token },
      transports: ['websocket'],
      reconnectionDelay: 500,
    })
    const events = []
    let ready = false
    socket.onAny((name, payload) => events.push({ name, payload, at: Date.now() }))
    socket.on('disconnect', (reason) => console.log(`SOCKET disconnected: ${reason}`))
    socket.io.on('reconnect', () => console.log('SOCKET reconnected'))
    socket.on('connect', () => {
      if (ready) return
      ready = true
      sockets.push(socket)
      resolve({ socket, events })
    })
    socket.on('connect_error', (error) => {
      if (ready) return
      socket.close()
      reject(error)
    })
  })
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function waitFor(check, seconds = 80) {
  for (let i = 0; i < seconds; i += 2) {
    const value = await check()
    if (value) return value
    await sleep(2000)
  }
  return null
}
const seen = (listener, name, test = () => true) =>
  waitFor(() => listener.events.find((event) => event.name === name && test(event.payload)), 10)
const ist = (minutes) => {
  const d = new Date(Date.now() + minutes * 60_000 + 330 * 60_000)
  return `${d.toISOString().slice(0, 19)}+05:30`
}
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0]
const notified = async (template, userId, since) =>
  Number(
    (
      await one(
        `SELECT COUNT(DISTINCT batch_id) AS n FROM notifications WHERE template_code = $1 AND user_id = $2 AND created_at >= $3`,
        [template, userId, since]
      )
    ).n
  )
const signed = (payload) => {
  const raw = JSON.stringify(payload)
  return {
    raw,
    headers: {
      'Agora-Signature-V2': createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex'),
    },
  }
}

async function cleanup() {
  await db.query(
    `DELETE FROM meeting_call_logs WHERE meeting_id IN (SELECT id FROM meetings WHERE title LIKE 'D8:%')`
  )
  await db.query(`DELETE FROM meetings WHERE title LIKE 'D8:%'`)
  await db.query(
    `DELETE FROM diary_recipients WHERE entry_id IN (SELECT id FROM diary_entries WHERE title LIKE 'D8:%')`
  )
  await db.query(
    `DELETE FROM diary_attachments WHERE entry_id IN (SELECT id FROM diary_entries WHERE title LIKE 'D8:%')`
  )
  await db.query(`DELETE FROM diary_entries WHERE title LIKE 'D8:%'`)
  for (const table of [
    'announcement_recipients',
    'announcement_targets',
    'announcement_attachments',
  ]) {
    await db.query(
      `DELETE FROM ${table} WHERE announcement_id IN (SELECT id FROM announcements WHERE title LIKE 'D8:%')`
    )
  }
  await db.query(`DELETE FROM announcements WHERE title LIKE 'D8:%'`)
  const stale = `SELECT DISTINCT thread_id FROM chat_messages WHERE body LIKE 'D8:%'`
  await db.query(`DELETE FROM chat_audit_logs WHERE thread_id IN (${stale})`)
  await db.query(`DELETE FROM chat_threads WHERE id IN (${stale})`)
  await db.query(`DELETE FROM chat_messages WHERE thread_id NOT IN (SELECT id FROM chat_threads)`)
  await restoreYear()
}

async function restoreYear() {
  const old = await one(`SELECT id FROM academic_years WHERE name = 'D8 old year'`)
  if (!old) return
  const current = await one(
    `SELECT id FROM academic_years WHERE is_current AND deleted_at IS NULL AND school_id = 1`
  )
  for (const table of ['meetings', 'diary_entries', 'announcements', 'chat_threads']) {
    await db.query(`UPDATE ${table} SET academic_year_id = $1 WHERE academic_year_id = $2`, [
      current.id,
      old.id,
    ])
  }
  await db.query(`DELETE FROM academic_years WHERE id = $1`, [old.id])
}

async function main() {
  await db.connect()
  await new Promise((resolve) => agoraMock.listen(AGORA_MOCK_PORT, resolve))
  await cleanup()

  const health = await fetch(`${ORIGIN}/api/health`)
  lastCall = { method: 'GET', path: '/health' }
  record(
    'D8',
    'Smoke',
    'API health endpoint responds',
    health.status === 200,
    `HTTP ${health.status}`,
    '200'
  )

  lastCall = { method: 'GET', path: '/api/docs/mobile-json' }
  const mobileDocs = await (await fetch(`${ORIGIN}/api/docs/mobile-json`)).json()
  const adminDocs = await (await fetch(`${ORIGIN}/api/docs/admin-json`)).json()
  const mobilePaths = Object.keys(mobileDocs.paths)
  const adminPaths = Object.keys(adminDocs.paths)
  record(
    'D8',
    'Smoke',
    'Mobile Swagger lists diary, chat, meeting extend and me/announcements',
    [
      '/api/v1/mobile/teacher/diary',
      '/api/v1/mobile/parent/children/{id}/diary',
      '/api/v1/mobile/parent/chat/threads',
      '/api/v1/mobile/teacher/meetings/{meetingId}/extend',
      '/api/v1/me/announcements',
    ].every((p) => mobilePaths.includes(p)),
    undefined,
    'All five routes present'
  )
  record(
    'D8',
    'Smoke',
    'Parents have no end-meeting route (host only)',
    !mobilePaths.includes('/api/v1/mobile/parent/meetings/{meetingId}/end'),
    undefined,
    'No /mobile/parent/meetings/{id}/end'
  )
  lastCall = { method: 'GET', path: '/api/docs/admin-json' }
  record(
    'D8',
    'Smoke',
    'Admin Swagger lists diary, announcements, chat audit and the Agora webhook',
    [
      '/api/v1/admin/diary',
      '/api/v1/admin/announcements',
      '/api/v1/admin/chat/threads',
      '/api/v1/integrations/agora/events',
    ].every((p) => adminPaths.includes(p)),
    undefined,
    'All four routes present'
  )

  const admin = await login('9876543210', 'admin')
  const teacher = await login('9000000004', 'mobile')
  const parent = await login('9000000005', 'mobile')
  const other = await login('9000000006', 'mobile')
  const transport = await login('9000000003', 'admin')
  record(
    'D8',
    'Smoke',
    'Admin, teacher, parent, second parent and transport sign in',
    true,
    undefined,
    'Tokens issued'
  )

  let parentLive
  let teacherLive
  try {
    parentLive = await connect(parent.token)
    teacherLive = await connect(teacher.token)
    lastCall = { method: 'WS', path: '/comm' }
    record(
      'D8',
      'Smoke',
      'Teacher and parent connect to the /comm socket with their token',
      true,
      'connected',
      'Connected'
    )
  } catch (error) {
    lastCall = { method: 'WS', path: '/comm' }
    record(
      'D8',
      'Smoke',
      'Teacher and parent connect to the /comm socket with their token',
      false,
      String(error.message)
    )
    throw error
  }
  const refused = await connect('not-a-token').then(
    () => null,
    (error) => error
  )
  record(
    'D8',
    'Security',
    '/comm refuses a socket without a valid token',
    Boolean(refused),
    refused?.message,
    'Connection refused'
  )

  const children = await call('GET', '/mobile/parent/children', { token: parent.token })
  const child = children.data[0]
  const classes = await call('GET', '/mobile/teacher/classes', { token: teacher.token })
  const mySection = classes.data.find((row) => row.is_class_teacher) ?? classes.data[0]
  const guardian = (
    await call('GET', '/admin/guardians', { token: admin.token, query: { search: '9000000005' } })
  ).data.items[0]
  const year = await one(
    `SELECT id, school_id FROM academic_years WHERE is_current AND deleted_at IS NULL AND school_id = 1`
  )
  const oldYear = await one(
    `INSERT INTO academic_years (school_id, name, start_date, end_date, is_current, created_at, updated_at)
     VALUES ($1, 'D8 old year', '2024-06-01', '2025-04-30', false, now(), now()) RETURNING id`,
    [year.school_id]
  )
  const start = new Date(Date.now() - 1000)

  // ---------------- Meetings ----------------
  const m1 = await call('POST', '/mobile/teacher/meetings', {
    token: teacher.token,
    body: {
      student_id: child.id,
      parent_user_id: parent.user.id,
      title: 'D8: Maths progress',
      scheduled_at: ist(1),
      duration_minutes: 15,
    },
  })
  record(
    'VM',
    'Functional',
    'Teacher books a meeting: scheduled, in the current academic year, teacher is host',
    m1.status === 201 &&
      m1.data.status === 'scheduled' &&
      m1.data.academic_year.id === year.id &&
      m1.data.host_id === teacher.user.id,
    `${m1.status} ${m1.data?.status} year=${m1.data?.academic_year?.name} host=${m1.data?.host_id}`,
    '201 scheduled, current year, host = teacher'
  )
  const id1 = m1.data.id
  const minutes = (a, b) => Math.round((new Date(b) - new Date(a)) / 60000)
  record(
    'VM',
    'Functional',
    'Scheduled end is start plus the booked 15 minutes',
    minutes(m1.data.scheduled_at, m1.data.ends_at) === 15,
    `${minutes(m1.data.scheduled_at, m1.data.ends_at)} min`,
    '15 min'
  )

  const pJoin = await call('POST', `/mobile/parent/meetings/${id1}/join`, {
    token: parent.token,
    body: { platform: 'android' },
  })
  record(
    'VM',
    'Functional',
    'Parent joins: meeting becomes in_progress, role participant, short-lived 007 token',
    pJoin.status === 200 &&
      pJoin.data.meeting.status === 'in_progress' &&
      pJoin.data.role === 'participant' &&
      pJoin.data.token.startsWith('007') &&
      Math.abs(new Date(pJoin.data.expires_at) - Date.now() - 900_000) < 15_000,
    `${pJoin.status} ${pJoin.data?.meeting?.status} role=${pJoin.data?.role}`,
    '200 in_progress, participant, token for 15 minutes'
  )
  const tJoin = await call('POST', `/mobile/teacher/meetings/${id1}/join`, {
    token: teacher.token,
    body: { platform: 'ios' },
  })
  record(
    'VM',
    'Functional',
    'Teacher joins the same channel as host',
    tJoin.status === 200 &&
      tJoin.data.role === 'host' &&
      tJoin.data.channel_name === pJoin.data.channel_name,
    `${tJoin.status} role=${tJoin.data?.role}`,
    '200 host, same channel'
  )
  lastCall = { method: 'WS', path: '/comm meeting.participant' }
  record(
    'VM',
    'Realtime',
    'Parent sees the teacher join live (meeting.participant)',
    Boolean(
      await seen(
        parentLive,
        'meeting.participant',
        (p) => p.meeting_id === id1 && p.user_id === teacher.user.id && p.action === 'joined'
      )
    ),
    undefined,
    'Event received'
  )
  const renew = await call('POST', `/mobile/parent/meetings/${id1}/token`, { token: parent.token })
  record(
    'VM',
    'Functional',
    'Parent renews the token before it expires',
    renew.status === 200 && renew.data.token.startsWith('007'),
    describe(renew),
    '200 new token'
  )

  expectStatus(
    'VM',
    'Security',
    'Parent cannot extend (host only, no route)',
    await call('POST', `/mobile/parent/meetings/${id1}/extend`, {
      token: parent.token,
      body: { minutes: 10 },
    }),
    404
  )
  const ext = await call('POST', `/mobile/teacher/meetings/${id1}/extend`, {
    token: teacher.token,
    body: { minutes: 10 },
  })
  record(
    'VM',
    'Functional',
    'Host extends by 10 minutes: new end, extended_by recorded',
    ext.status === 200 &&
      ext.data.extended_minutes === 10 &&
      ext.data.extended_by?.id === teacher.user.id &&
      minutes(m1.data.ends_at, ext.data.ends_at) === 10,
    `${ext.status} +${ext.data?.extended_minutes} end moved ${minutes(m1.data.ends_at, ext.data?.ends_at)} min`,
    '200, +10, ends 10 min later'
  )
  lastCall = { method: 'WS', path: '/comm meeting.status' }
  record(
    'VM',
    'Realtime',
    'Parent sees the new end time live (meeting.status)',
    Boolean(
      await seen(
        parentLive,
        'meeting.status',
        (p) => p.meeting_id === id1 && p.extended_minutes === 10
      )
    ),
    undefined,
    'Event received'
  )
  expectStatus(
    'VM',
    'Validation',
    'Extension of 3 minutes is refused',
    await call('POST', `/mobile/teacher/meetings/${id1}/extend`, {
      token: teacher.token,
      body: { minutes: 3 },
    }),
    400,
    'VALIDATION_FAILED',
    'minutes'
  )
  await db.query(`UPDATE meetings SET extended_minutes = 115 WHERE id = $1`, [id1])
  expectStatus(
    'VM',
    'Validation',
    'Extensions over 120 minutes in total are refused',
    await call('POST', `/mobile/teacher/meetings/${id1}/extend`, {
      token: teacher.token,
      body: { minutes: 10 },
    }),
    400,
    'VALIDATION_FAILED',
    'minutes'
  )
  await db.query(`UPDATE meetings SET extended_minutes = 10 WHERE id = $1`, [id1])

  await db.query(
    `UPDATE meetings SET scheduled_end_at = now() + interval '4 minutes', end_reminder_sent_at = NULL WHERE id = $1`,
    [id1]
  )
  lastCall = { method: 'CRON', path: 'meeting-lifecycle: end reminder' }
  const reminded = await waitFor(
    async () =>
      (await one(`SELECT end_reminder_sent_at FROM meetings WHERE id = $1`, [id1]))
        .end_reminder_sent_at
  )
  const endingPushes =
    (await notified('MEETING_ENDING', parent.user.id, start)) +
    (await notified('MEETING_ENDING', teacher.user.id, start))
  record(
    'VM',
    'Regression',
    'Five minutes before the end both people get the MEETING_ENDING reminder once',
    Boolean(reminded) && endingPushes === 2,
    `sent=${Boolean(reminded)} pushes=${endingPushes}`,
    'Reminder sent, 2 pushes'
  )
  record(
    'VM',
    'Realtime',
    'The in-call reminder arrives on the socket (meeting.reminder ending)',
    Boolean(
      await seen(
        teacherLive,
        'meeting.reminder',
        (p) => p.meeting_id === id1 && p.kind === 'ending'
      )
    ),
    undefined,
    'Event received'
  )
  await sleep(61_000)
  record(
    'VM',
    'Regression',
    'The reminder is not sent twice',
    (await notified('MEETING_ENDING', parent.user.id, start)) === 1,
    undefined,
    'Still one push'
  )

  await db.query(
    `UPDATE meetings SET scheduled_end_at = now() - interval '1 minute' WHERE id = $1`,
    [id1]
  )
  lastCall = { method: 'CRON', path: 'meeting-lifecycle: over time' }
  const exceeded = await waitFor(
    async () =>
      (await one(`SELECT status FROM meetings WHERE id = $1`, [id1])).status === 'time_exceeded'
  )
  record(
    'VM',
    'Regression',
    'At the scheduled end the meeting becomes time_exceeded and is not closed',
    Boolean(exceeded),
    undefined,
    'time_exceeded'
  )
  record(
    'VM',
    'Realtime',
    'Both apps are told it is over time (meeting.status time_exceeded)',
    Boolean(
      await seen(
        parentLive,
        'meeting.status',
        (p) => p.meeting_id === id1 && p.status === 'time_exceeded'
      )
    ),
    undefined,
    'Event received'
  )
  const late = await call('POST', `/mobile/parent/meetings/${id1}/join`, {
    token: parent.token,
    body: {},
  })
  record(
    'VM',
    'Functional',
    'A participant can still join after the scheduled end',
    late.status === 200 && late.data.meeting.status === 'time_exceeded',
    describe(late),
    '200 time_exceeded'
  )

  expectStatus(
    'VM',
    'Security',
    'Parent cannot end the meeting (host only, no route)',
    await call('POST', `/mobile/parent/meetings/${id1}/end`, { token: parent.token }),
    404
  )
  const kicksBefore = kicks.length
  const end = await call('POST', `/mobile/teacher/meetings/${id1}/end`, { token: teacher.token })
  record(
    'VM',
    'Functional',
    'Host ends for everyone: completed, host_ended, actual length kept',
    end.status === 200 &&
      end.data.status === 'completed' &&
      end.data.end_reason === 'host_ended' &&
      typeof end.data.call_minutes === 'number',
    `${end.status} ${end.data?.status} ${end.data?.end_reason} ${end.data?.call_minutes} min`,
    '200 completed, host_ended'
  )
  const kick = kicks[kicksBefore]
  lastCall = { method: 'POST', path: 'Agora /dev/v1/kicking-rule' }
  record(
    'VM',
    'Integration',
    'Ending calls the Agora kicking rule for the whole channel with Basic auth',
    Boolean(kick) &&
      kick.url === '/dev/v1/kicking-rule' &&
      kick.auth ===
        `Basic ${Buffer.from('test-customer-id:test-customer-secret').toString('base64')}` &&
      kick.body.cname === pJoin.data.channel_name &&
      kick.body.uid === undefined &&
      kick.body.privileges.join() === 'join_channel',
    kick ? `${kick.url} cname=${kick.body?.cname} time=${kick.body?.time}` : 'no request',
    'POST kicking-rule, cname only, join_channel'
  )
  const kickId = (await one(`SELECT agora_kick_rule_id FROM meetings WHERE id = $1`, [id1]))
    .agora_kick_rule_id
  record(
    'VM',
    'Integration',
    'The Agora rule id is saved on the meeting',
    kickId === String(7700 + kicksBefore + 1),
    `rule ${kickId}`,
    'Rule id saved'
  )
  record(
    'VM',
    'Realtime',
    'Parent app is told the meeting ended (meeting.status completed)',
    Boolean(
      await seen(
        parentLive,
        'meeting.status',
        (p) => p.meeting_id === id1 && p.status === 'completed'
      )
    ),
    undefined,
    'Event received'
  )
  const detail1 = await call('GET', `/admin/meetings/${id1}`, { token: admin.token })
  record(
    'VM',
    'Functional',
    'Every call-log row is closed when the host ends',
    detail1.data.call_log.length >= 3 && detail1.data.call_log.every((row) => row.left_at),
    `${detail1.data.call_log.length} rows`,
    'All rows have left_at'
  )
  expectStatus(
    'VM',
    'Security',
    'Nobody can join a completed meeting',
    await call('POST', `/mobile/parent/meetings/${id1}/join`, { token: parent.token, body: {} }),
    409,
    'MEETING_ENDED'
  )
  expectStatus(
    'VM',
    'Security',
    'No new token for a completed meeting',
    await call('POST', `/mobile/teacher/meetings/${id1}/token`, { token: teacher.token }),
    409,
    'MEETING_ENDED'
  )

  const m3 = await call('POST', '/mobile/teacher/meetings', {
    token: teacher.token,
    body: {
      student_id: child.id,
      title: 'D8: Webhook',
      scheduled_at: ist(1440),
      duration_minutes: 15,
    },
  })
  const channel3 = (await one(`SELECT channel_name FROM meetings WHERE id = $1`, [m3.data.id]))
    .channel_name
  const join107 = signed({
    noticeId: 'd8-1',
    productId: 1,
    eventType: 107,
    notifyMs: Date.now(),
    payload: {
      channelName: channel3,
      uid: teacher.user.id,
      platform: 1,
      clientSeq: 10,
      ts: Math.floor(Date.now() / 1000),
    },
  })
  const hook1 = await call('POST', '/integrations/agora/events', {
    raw: join107.raw,
    headers: join107.headers,
  })
  await call('POST', '/integrations/agora/events', { raw: join107.raw, headers: join107.headers })
  const agoraRows = (
    await db.query(`SELECT * FROM meeting_call_logs WHERE meeting_id = $1`, [m3.data.id])
  ).rows
  record(
    'VM',
    'Integration',
    'Signed Agora join event (107) adds an attendance row from Agora, once even if sent twice',
    hook1.status === 200 && agoraRows.length === 1 && agoraRows[0].source === 'agora',
    `${hook1.status} rows=${agoraRows.length} source=${agoraRows[0]?.source}`,
    '200, one agora row'
  )
  const leave108 = signed({
    noticeId: 'd8-2',
    productId: 1,
    eventType: 108,
    notifyMs: Date.now(),
    payload: {
      channelName: channel3,
      uid: teacher.user.id,
      platform: 1,
      clientSeq: 11,
      reason: 10,
      ts: Math.floor(Date.now() / 1000),
    },
  })
  await call('POST', '/integrations/agora/events', { raw: leave108.raw, headers: leave108.headers })
  const left = await one(
    `SELECT left_at, leave_reason FROM meeting_call_logs WHERE meeting_id = $1`,
    [m3.data.id]
  )
  record(
    'VM',
    'Integration',
    'Signed leave event (108, reason 10) closes the row as a network drop',
    Boolean(left.left_at) && left.leave_reason === 'network',
    `reason=${left.leave_reason}`,
    'left_at set, reason network'
  )
  expectStatus(
    'VM',
    'Security',
    'Agora webhook with a wrong signature is refused',
    await call('POST', '/integrations/agora/events', {
      raw: join107.raw,
      headers: { 'Agora-Signature-V2': 'deadbeef' },
    }),
    401,
    'SIGNATURE_INVALID'
  )
  const stranger = signed({
    noticeId: 'd8-3',
    productId: 1,
    eventType: 107,
    payload: { channelName: channel3, uid: 999999, clientSeq: 12 },
  })
  const ignored = await call('POST', '/integrations/agora/events', {
    raw: stranger.raw,
    headers: stranger.headers,
  })
  record(
    'VM',
    'Security',
    'A uid that is not a participant is ignored',
    ignored.status === 200 &&
      (
        await db.query(
          `SELECT 1 FROM meeting_call_logs WHERE meeting_id = $1 AND user_id = 999999`,
          [m3.data.id]
        )
      ).rowCount === 0,
    describe(ignored),
    '200, nothing stored'
  )

  await db.query(
    `UPDATE meetings SET status = 'in_progress', started_at = now() - interval '50 minutes',
       scheduled_at = now() - interval '50 minutes', scheduled_end_at = now() - interval '35 minutes' WHERE id = $1`,
    [m3.data.id]
  )
  await db.query(
    `UPDATE meeting_call_logs SET joined_at = now() - interval '45 minutes', left_at = now() - interval '20 minutes' WHERE meeting_id = $1`,
    [m3.data.id]
  )
  lastCall = { method: 'CRON', path: 'meeting-lifecycle: empty meeting' }
  const emptied = await waitFor(
    async () =>
      (await one(`SELECT status, end_reason FROM meetings WHERE id = $1`, [m3.data.id]))
        .end_reason === 'empty'
  )
  record(
    'VM',
    'Regression',
    'A meeting everyone left 15+ minutes after its end closes as completed (empty)',
    Boolean(emptied),
    undefined,
    'completed, empty'
  )

  const m4 = await call('POST', `/mobile/parent/children/${child.id}/meetings`, {
    token: parent.token,
    body: {
      teacher_user_id: teacher.user.id,
      title: 'D8: No show',
      scheduled_at: ist(2880),
      duration_minutes: 15,
    },
  })
  record(
    'VM',
    'Functional',
    'Parent books a meeting with the class teacher (parent → teacher)',
    m4.status === 201 && m4.data.from.id === parent.user.id && m4.data.to.id === teacher.user.id,
    describe(m4),
    '201, from parent to teacher'
  )
  await db.query(
    `UPDATE meetings SET scheduled_at = now() - interval '60 minutes', scheduled_end_at = now() - interval '45 minutes' WHERE id = $1`,
    [m4.data.id]
  )
  lastCall = { method: 'CRON', path: 'meeting-lifecycle: no-show' }
  record(
    'VM',
    'Regression',
    'A meeting nobody joined becomes missed 30 minutes after its end',
    Boolean(
      await waitFor(
        async () =>
          (await one(`SELECT status FROM meetings WHERE id = $1`, [m4.data.id])).status === 'missed'
      )
    ),
    undefined,
    'missed'
  )

  const m5 = await call('POST', '/mobile/teacher/meetings', {
    token: teacher.token,
    body: {
      student_id: child.id,
      title: 'D8: Start reminder',
      scheduled_at: ist(4320),
      duration_minutes: 15,
    },
  })
  await db.query(
    `UPDATE meetings SET scheduled_at = now() + interval '5 minutes', scheduled_end_at = now() + interval '20 minutes', reminder_sent_at = NULL WHERE id = $1`,
    [m5.data.id]
  )
  lastCall = { method: 'CRON', path: 'meeting-lifecycle: start reminder' }
  record(
    'VM',
    'Regression',
    'MEETING_REMINDER goes out 10 minutes before the start',
    Boolean(
      await waitFor(
        async () =>
          (await one(`SELECT reminder_sent_at FROM meetings WHERE id = $1`, [m5.data.id]))
            .reminder_sent_at
      )
    ),
    undefined,
    'reminder_sent_at set'
  )
  expectStatus(
    'VM',
    'Functional',
    'Booking over another meeting is refused',
    await call('POST', '/mobile/teacher/meetings', {
      token: teacher.token,
      body: {
        student_id: child.id,
        title: 'D8: Clash',
        scheduled_at: ist(7),
        duration_minutes: 15,
      },
    }),
    409,
    'MEETING_CLASH'
  )
  expectStatus(
    'VM',
    'Functional',
    'Ending a meeting nobody joined is refused',
    await call('POST', `/mobile/teacher/meetings/${m5.data.id}/end`, { token: teacher.token }),
    409,
    'MEETING_NOT_LIVE'
  )
  const cancel = await call('POST', `/mobile/teacher/meetings/${m5.data.id}/cancel`, {
    token: teacher.token,
    body: { reason: 'Staff meeting' },
  })
  record(
    'VM',
    'Functional',
    'Teacher cancels a meeting that has not started; the parent is told',
    cancel.status === 200 &&
      cancel.data.status === 'cancelled' &&
      (await notified('MEETING_CANCELLED', parent.user.id, start)) >= 1,
    describe(cancel),
    '200 cancelled, MEETING_CANCELLED push'
  )
  expectStatus(
    'VM',
    'Validation',
    'Missing title',
    await call('POST', '/mobile/teacher/meetings', {
      token: teacher.token,
      body: { student_id: child.id, scheduled_at: ist(600) },
    }),
    400,
    'VALIDATION_FAILED',
    'title'
  )
  expectStatus(
    'VM',
    'Validation',
    'scheduled_at without a time zone',
    await call('POST', '/mobile/teacher/meetings', {
      token: teacher.token,
      body: { student_id: child.id, title: 'D8: x', scheduled_at: '2026-12-01T10:00:00' },
    }),
    400,
    'VALIDATION_FAILED',
    'scheduled_at'
  )
  expectStatus(
    'VM',
    'Validation',
    'scheduled_at in the past',
    await call('POST', '/mobile/teacher/meetings', {
      token: teacher.token,
      body: { student_id: child.id, title: 'D8: x', scheduled_at: ist(-30) },
    }),
    400,
    'VALIDATION_FAILED',
    'scheduled_at'
  )
  expectStatus(
    'VM',
    'Validation',
    'Parent books someone who does not teach the child',
    await call('POST', `/mobile/parent/children/${child.id}/meetings`, {
      token: parent.token,
      body: { teacher_user_id: transport.user.id, title: 'D8: x', scheduled_at: ist(600) },
    }),
    400,
    'VALIDATION_FAILED',
    'teacher_user_id'
  )
  expectStatus(
    'VM',
    'Security',
    'Another parent cannot open this meeting',
    await call('GET', `/mobile/parent/meetings/${id1}`, { token: other.token }),
    404,
    'MEETING_NOT_FOUND'
  )
  expectStatus(
    'VM',
    'Security',
    'Transport in-charge (no meetings.view) cannot read meetings',
    await call('GET', '/admin/meetings', { token: transport.token }),
    403,
    'FORBIDDEN'
  )

  await db.query(`UPDATE meetings SET academic_year_id = $2 WHERE id = $1`, [
    m4.data.id,
    oldYear.id,
  ])
  const adminAll = await call('GET', '/admin/meetings', {
    token: admin.token,
    query: { limit: 100, search: 'D8:' },
  })
  const parentPast = await call('GET', '/mobile/parent/meetings', {
    token: parent.token,
    query: { scope: 'all', limit: 100 },
  })
  record(
    'VM',
    'Academic year',
    'A meeting of an earlier academic year is hidden from the office and the apps',
    !adminAll.data.items.some((m) => m.id === m4.data.id) &&
      !parentPast.data.items.some((m) => m.id === m4.data.id),
    `admin=${adminAll.data.items.length} parent=${parentPast.data.items.length}`,
    'Not listed'
  )
  expectStatus(
    'VM',
    'Academic year',
    'Opening an earlier-year meeting returns not found',
    await call('GET', `/admin/meetings/${m4.data.id}`, { token: admin.token }),
    404,
    'MEETING_NOT_FOUND'
  )

  // ---------------- Diary ----------------
  await call('PATCH', '/admin/school', {
    token: admin.token,
    body: { diary_review_mode: 'remarks' },
  })
  const hw = await call('POST', '/mobile/teacher/diary', {
    token: teacher.token,
    body: {
      type: 'homework',
      scope: 'section',
      section_id: mySection.section_id,
      title: 'D8: Exercise 4.2',
      body: 'Questions 1 to 10 in the notebook.',
      due_date: ist(1440).slice(0, 10),
    },
  })
  record(
    'DY',
    'Functional',
    'Homework to my section is published at once to every student (review mode: remarks)',
    hw.status === 201 &&
      hw.data.status === 'published' &&
      hw.data.recipient_count === mySection.student_count &&
      hw.data.target_label.includes(mySection.section_name),
    `${hw.status} ${hw.data?.status} to ${hw.data?.target_label} (${hw.data?.recipient_count})`,
    '201 published to the whole section'
  )
  const feed = await call('GET', `/mobile/parent/children/${child.id}/diary`, {
    token: parent.token,
  })
  const inFeed = feed.data.items.find((item) => item.id === hw.data.id)
  record(
    'DY',
    'Functional',
    'It appears in the parent feed, not yet seen',
    Boolean(inFeed) && inFeed.seen === false,
    describe(feed),
    'Listed, seen=false'
  )
  record(
    'DY',
    'Functional',
    'Parents got the DIARY_POSTED push',
    (await notified('DIARY_POSTED', parent.user.id, start)) >= 1,
    undefined,
    'Push sent'
  )
  const seenRes = await call(
    'POST',
    `/mobile/parent/children/${child.id}/diary/${hw.data.id}/seen`,
    { token: parent.token }
  )
  const tDetail = await call('GET', `/mobile/teacher/diary/${hw.data.id}`, { token: teacher.token })
  record(
    'DY',
    'Functional',
    'Parent marks it seen; the teacher sees who saw it',
    seenRes.status === 200 &&
      tDetail.data.seen_count === 1 &&
      tDetail.data.recipients.some(
        (r) => r.student.id === child.id && r.seen_by?.id === parent.user.id
      ),
    `seen_count=${tDetail.data?.seen_count}`,
    'seen_count 1, seen_by parent'
  )

  const remark = await call('POST', '/mobile/teacher/diary', {
    token: teacher.token,
    body: {
      type: 'remark',
      scope: 'students',
      student_ids: [child.id],
      title: 'D8: Talking in class',
      body: 'Please speak to Kavin about listening in class.',
    },
  })
  record(
    'DY',
    'Functional',
    'A remark waits for the office (pending_review) and is not in the feed',
    remark.status === 201 &&
      remark.data.status === 'pending_review' &&
      !(
        await call('GET', `/mobile/parent/children/${child.id}/diary`, { token: parent.token })
      ).data.items.some((item) => item.id === remark.data.id),
    `${remark.status} ${remark.data?.status}`,
    '201 pending_review, not in feed'
  )
  const pending = await call('GET', '/admin/diary', {
    token: admin.token,
    query: { status: 'pending_review' },
  })
  const dInsights = await call('GET', '/admin/diary/insights', { token: admin.token })
  record(
    'DY',
    'Functional',
    'The office sees it in the review queue and the insight count',
    pending.data.items.some((item) => item.id === remark.data.id) &&
      dInsights.data.pending_review >= 1 &&
      dInsights.data.review_mode === 'remarks',
    `pending=${dInsights.data?.pending_review} mode=${dInsights.data?.review_mode}`,
    'Listed, pending ≥ 1, mode remarks'
  )
  expectStatus(
    'DY',
    'Validation',
    'Sending back without a reason is refused',
    await call('POST', `/admin/diary/${remark.data.id}/reject`, { token: admin.token, body: {} }),
    400,
    'VALIDATION_FAILED',
    'note'
  )
  const rejected = await call('POST', `/admin/diary/${remark.data.id}/reject`, {
    token: admin.token,
    body: { note: 'Please write this more kindly' },
  })
  record(
    'DY',
    'Functional',
    'Office sends it back; the teacher gets DIARY_REJECTED with the reason',
    rejected.status === 200 &&
      rejected.data.status === 'rejected' &&
      rejected.data.review.note === 'Please write this more kindly' &&
      (await notified('DIARY_REJECTED', teacher.user.id, start)) >= 1,
    describe(rejected),
    '200 rejected, teacher told'
  )
  const edited = await call('PATCH', `/mobile/teacher/diary/${remark.data.id}`, {
    token: teacher.token,
    body: {
      title: 'D8: Listening in class',
      body: 'Kavin can listen more closely during lessons; please encourage him.',
    },
  })
  record(
    'DY',
    'Functional',
    'Teacher edits it; it goes back for review with the old review cleared',
    edited.status === 200 &&
      edited.data.status === 'pending_review' &&
      edited.data.review.note === null,
    describe(edited),
    '200 pending_review'
  )
  const approved = await call('POST', `/admin/diary/${remark.data.id}/approve`, {
    token: admin.token,
  })
  record(
    'DY',
    'Functional',
    'Office approves: published and in the parent feed',
    approved.status === 200 &&
      approved.data.status === 'published' &&
      (
        await call('GET', `/mobile/parent/children/${child.id}/diary`, { token: parent.token })
      ).data.items.some((item) => item.id === remark.data.id),
    describe(approved),
    '200 published, in feed'
  )
  expectStatus(
    'DY',
    'Functional',
    'A published post can no longer be edited',
    await call('PATCH', `/mobile/teacher/diary/${remark.data.id}`, {
      token: teacher.token,
      body: { title: 'D8: x', body: 'y' },
    }),
    409,
    'DIARY_NOT_EDITABLE'
  )
  const hidden = await call('POST', `/admin/diary/${remark.data.id}/hide`, {
    token: admin.token,
    body: { note: 'Duplicate' },
  })
  record(
    'DY',
    'Functional',
    'Office hides it: it leaves the parent feed',
    hidden.status === 200 &&
      hidden.data.status === 'hidden' &&
      !(
        await call('GET', `/mobile/parent/children/${child.id}/diary`, { token: parent.token })
      ).data.items.some((item) => item.id === remark.data.id),
    describe(hidden),
    '200 hidden, not in feed'
  )
  const restored = await call('POST', `/admin/diary/${remark.data.id}/restore`, {
    token: admin.token,
  })
  record(
    'DY',
    'Functional',
    'Office restores it to the feed',
    restored.status === 200 && restored.data.status === 'published',
    describe(restored),
    '200 published'
  )

  await call('PATCH', '/admin/school', { token: admin.token, body: { diary_review_mode: 'all' } })
  const reviewedHw = await call('POST', '/mobile/teacher/diary', {
    token: teacher.token,
    body: {
      type: 'homework',
      scope: 'students',
      student_ids: [child.id],
      title: 'D8: Reading',
      body: 'Read chapter 3.',
    },
  })
  record(
    'DY',
    'Functional',
    'With review mode "all" even homework waits for the office',
    reviewedHw.status === 201 && reviewedHw.data.status === 'pending_review',
    `${reviewedHw.status} ${reviewedHw.data?.status}`,
    '201 pending_review'
  )
  await call('PATCH', '/admin/school', {
    token: admin.token,
    body: { diary_review_mode: 'remarks' },
  })
  expectStatus(
    'DY',
    'Validation',
    'School setting accepts only all or remarks',
    await call('PATCH', '/admin/school', {
      token: admin.token,
      body: { diary_review_mode: 'none' },
    }),
    400,
    'VALIDATION_FAILED',
    'diary_review_mode'
  )
  const dPost = (body) => call('POST', '/mobile/teacher/diary', { token: teacher.token, body })
  const base = {
    type: 'note',
    scope: 'section',
    section_id: mySection.section_id,
    title: 'D8: note',
    body: 'Text',
  }
  expectStatus(
    'DY',
    'Validation',
    'Missing title',
    await dPost({ ...base, title: undefined }),
    400,
    'VALIDATION_FAILED',
    'title'
  )
  expectStatus(
    'DY',
    'Validation',
    'Blank message',
    await dPost({ ...base, body: '   ' }),
    400,
    'VALIDATION_FAILED',
    'body'
  )
  expectStatus(
    'DY',
    'Validation',
    'Unknown type',
    await dPost({ ...base, type: 'circular' }),
    400,
    'VALIDATION_FAILED',
    'type'
  )
  expectStatus(
    'DY',
    'Validation',
    'Students scope with no students',
    await dPost({ ...base, scope: 'students', section_id: undefined, student_ids: [] }),
    400,
    'VALIDATION_FAILED',
    'student_ids'
  )
  expectStatus(
    'DY',
    'Validation',
    'Due date on a note',
    await dPost({ ...base, due_date: ist(1440).slice(0, 10) }),
    400,
    'VALIDATION_FAILED',
    'due_date'
  )
  expectStatus(
    'DY',
    'Validation',
    'Homework due date in the past',
    await dPost({ ...base, type: 'homework', due_date: '2026-01-01' }),
    400,
    'VALIDATION_FAILED',
    'due_date'
  )
  expectStatus(
    'DY',
    'Validation',
    'More than 5 attachments',
    await dPost({ ...base, file_ids: [1, 2, 3, 4, 5, 6] }),
    400,
    'VALIDATION_FAILED',
    'file_ids'
  )
  expectStatus(
    'DY',
    'Validation',
    'Unknown field',
    await dPost({ ...base, color: 'red' }),
    400,
    'VALIDATION_FAILED'
  )
  const foreignSection = await one(
    `SELECT s.id FROM sections s WHERE s.school_id = $1 AND s.academic_year_id = $2 AND s.deleted_at IS NULL
       AND s.id <> ALL($3::int[]) LIMIT 1`,
    [year.school_id, year.id, classes.data.map((row) => row.section_id)]
  )
  if (foreignSection) {
    expectStatus(
      'DY',
      'Security',
      'Teacher cannot post to a section they do not teach',
      await dPost({ ...base, section_id: foreignSection.id }),
      403,
      'NOT_YOUR_SECTION'
    )
  }
  expectStatus(
    'DY',
    'Security',
    'Parent cannot post to the diary',
    await call('POST', '/mobile/teacher/diary', { token: parent.token, body: base }),
    403,
    'FORBIDDEN'
  )
  expectStatus(
    'DY',
    'Security',
    'Teacher cannot use the office review routes',
    await call('POST', `/admin/diary/${reviewedHw.data.id}/approve`, { token: teacher.token }),
    403,
    'FORBIDDEN'
  )
  expectStatus(
    'DY',
    'Security',
    'Another parent cannot read this child’s diary',
    await call('GET', `/mobile/parent/children/${child.id}/diary`, { token: other.token }),
    404,
    'CHILD_NOT_FOUND'
  )
  expectStatus(
    'DY',
    'Security',
    'Transport in-charge cannot see the diary',
    await call('GET', '/admin/diary', { token: transport.token }),
    403,
    'FORBIDDEN'
  )
  const del = await call('DELETE', `/mobile/teacher/diary/${hw.data.id}`, { token: teacher.token })
  record(
    'DY',
    'Functional',
    'Teacher deletes a post; it leaves the parent feed',
    del.status === 200 &&
      !(
        await call('GET', `/mobile/parent/children/${child.id}/diary`, { token: parent.token })
      ).data.items.some((item) => item.id === hw.data.id),
    describe(del),
    '200, not in feed'
  )
  await db.query(`UPDATE diary_entries SET academic_year_id = $2 WHERE id = $1`, [
    remark.data.id,
    oldYear.id,
  ])
  record(
    'DY',
    'Academic year',
    'A post from an earlier academic year is hidden from the office and the feed',
    !(
      await call('GET', '/admin/diary', { token: admin.token, query: { limit: 100 } })
    ).data.items.some((item) => item.id === remark.data.id) &&
      !(
        await call('GET', `/mobile/parent/children/${child.id}/diary`, { token: parent.token })
      ).data.items.some((item) => item.id === remark.data.id),
    undefined,
    'Not listed'
  )

  // ---------------- Announcements ----------------
  const draft = await call('POST', '/admin/announcements', {
    token: admin.token,
    body: {
      title: 'D8: Sports day',
      body: 'Sports day is on Saturday at 8 am.',
      audience: 'parents',
    },
  })
  record(
    'AN',
    'Functional',
    'Office saves a draft for all parents',
    draft.status === 201 && draft.data.status === 'draft' && draft.data.recipient_count === 0,
    `${draft.status} ${draft.data?.status}`,
    '201 draft'
  )
  const published = await call('POST', `/admin/announcements/${draft.data.id}/publish`, {
    token: admin.token,
    body: {},
  })
  record(
    'AN',
    'Functional',
    'Publishing sends it to every parent with the app',
    published.status === 200 &&
      published.data.status === 'published' &&
      published.data.recipient_count > 0,
    `${published.status} to ${published.data?.recipient_count}`,
    '200 published'
  )
  const mine = await call('GET', '/me/announcements', { token: parent.token })
  const unread = await call('GET', '/me/announcements/unread-count', { token: parent.token })
  record(
    'AN',
    'Functional',
    'Parent sees it in /me/announcements with an unread badge and a push',
    mine.data.items.some((a) => a.id === draft.data.id && !a.is_read) &&
      unread.data.unread >= 1 &&
      (await notified('ANNOUNCEMENT', parent.user.id, start)) >= 1,
    `unread=${unread.data?.unread}`,
    'Listed unread, push sent'
  )
  const read = await call('POST', `/me/announcements/${draft.data.id}/read`, {
    token: parent.token,
  })
  const readers = await call('GET', `/admin/announcements/${draft.data.id}/readers`, {
    token: admin.token,
    query: { state: 'read' },
  })
  record(
    'AN',
    'Functional',
    'Parent reads it; the office sees the read count and the reader',
    read.status === 200 &&
      read.data.is_read &&
      readers.data.items.some((r) => r.user.id === parent.user.id),
    `readers=${readers.data?.total}`,
    'Read, listed as reader'
  )
  record(
    'AN',
    'Functional',
    'Staff do not get a parents-only announcement',
    !(await call('GET', '/me/announcements', { token: teacher.token })).data.items.some(
      (a) => a.id === draft.data.id
    ),
    undefined,
    'Not in teacher feed'
  )
  const staffOnly = await call('POST', '/admin/announcements', {
    token: admin.token,
    body: {
      title: 'D8: Staff meeting',
      body: 'Staff meeting at 3 pm in the hall.',
      audience: 'staff',
      publish_now: true,
    },
  })
  record(
    'AN',
    'Functional',
    'A staff announcement reaches teachers and not parents',
    staffOnly.data.status === 'published' &&
      (await call('GET', '/me/announcements', { token: teacher.token })).data.items.some(
        (a) => a.id === staffOnly.data.id
      ) &&
      !(await call('GET', '/me/announcements', { token: parent.token })).data.items.some(
        (a) => a.id === staffOnly.data.id
      ),
    staffOnly.data?.audience_label,
    'Teacher yes, parent no'
  )
  const classOnly = await call('POST', '/admin/announcements', {
    token: admin.token,
    body: {
      title: 'D8: 6-A trip',
      body: 'Science trip on Monday.',
      audience: 'classes',
      section_ids: [mySection.section_id],
      publish_now: true,
      priority: 'urgent',
    },
  })
  const wrongRecipients = await one(
    `SELECT COUNT(*) AS n FROM announcement_recipients r WHERE r.announcement_id = $1 AND NOT EXISTS (
       SELECT 1 FROM guardians g JOIN student_guardians sg ON sg.guardian_id = g.id
       JOIN student_enrollments e ON e.student_id = sg.student_id AND e.academic_year_id = $2 AND e.section_id = $3
       WHERE g.user_id = r.user_id)`,
    [classOnly.data.id, year.id, mySection.section_id]
  )
  record(
    'AN',
    'Functional',
    'An announcement to one section reaches only that section’s parents',
    classOnly.status === 201 &&
      classOnly.data.recipient_count > 0 &&
      Number(wrongRecipients.n) === 0,
    `${classOnly.data?.audience_label}: ${classOnly.data?.recipient_count}`,
    'Only parents of the section'
  )
  record(
    'AN',
    'Functional',
    'Urgent announcements use the urgent template (SMS when push fails)',
    (await notified('ANNOUNCEMENT_URGENT', parent.user.id, start)) >= 1,
    undefined,
    'ANNOUNCEMENT_URGENT sent'
  )
  const scheduled = await call('POST', '/admin/announcements', {
    token: admin.token,
    body: {
      title: 'D8: Later',
      body: 'Exam timetable will be shared.',
      audience: 'parents',
      publish_at: ist(120),
    },
  })
  record(
    'AN',
    'Functional',
    'A future publish time schedules it',
    scheduled.status === 201 && scheduled.data.status === 'scheduled',
    `${scheduled.status} ${scheduled.data?.status}`,
    '201 scheduled'
  )
  await db.query(
    `UPDATE announcements SET publish_at = now() - interval '1 minute' WHERE id = $1`,
    [scheduled.data.id]
  )
  lastCall = { method: 'CRON', path: 'announcements-scheduled' }
  record(
    'AN',
    'Regression',
    'The scheduler publishes it when the time comes',
    Boolean(
      await waitFor(
        async () =>
          (await one(`SELECT status FROM announcements WHERE id = $1`, [scheduled.data.id]))
            .status === 'published'
      )
    ),
    undefined,
    'published'
  )
  expectStatus(
    'AN',
    'Functional',
    'A published announcement cannot be edited',
    await call('PATCH', `/admin/announcements/${draft.data.id}`, {
      token: admin.token,
      body: { title: 'D8: x', body: 'y', audience: 'parents' },
    }),
    409,
    'ANNOUNCEMENT_NOT_EDITABLE'
  )
  expectStatus(
    'AN',
    'Functional',
    'A published announcement cannot be deleted',
    await call('DELETE', `/admin/announcements/${draft.data.id}`, { token: admin.token }),
    409,
    'ANNOUNCEMENT_NOT_EDITABLE'
  )
  const archived = await call('POST', `/admin/announcements/${draft.data.id}/archive`, {
    token: admin.token,
  })
  record(
    'AN',
    'Functional',
    'Archiving takes it out of every feed',
    archived.data.status === 'archived' &&
      !(await call('GET', '/me/announcements', { token: parent.token })).data.items.some(
        (a) => a.id === draft.data.id
      ),
    describe(archived),
    '200 archived, not in feed'
  )
  await db.query(
    `UPDATE announcements SET expires_at = now() - interval '1 minute' WHERE id = $1`,
    [scheduled.data.id]
  )
  record(
    'AN',
    'Functional',
    'An expired announcement leaves the feed',
    !(await call('GET', '/me/announcements', { token: parent.token })).data.items.some(
      (a) => a.id === scheduled.data.id
    ),
    undefined,
    'Not in feed'
  )
  const draft2 = await call('POST', '/admin/announcements', {
    token: admin.token,
    body: { title: 'D8: Draft to delete', body: 'x', audience: 'everyone' },
  })
  expectStatus(
    'AN',
    'Functional',
    'A draft can be deleted',
    await call('DELETE', `/admin/announcements/${draft2.data.id}`, { token: admin.token }),
    200
  )
  const aPost = (body) => call('POST', '/admin/announcements', { token: admin.token, body })
  const aBase = { title: 'D8: v', body: 'Text', audience: 'parents' }
  expectStatus(
    'AN',
    'Validation',
    'Missing title',
    await aPost({ ...aBase, title: undefined }),
    400,
    'VALIDATION_FAILED',
    'title'
  )
  expectStatus(
    'AN',
    'Validation',
    'Unknown audience',
    await aPost({ ...aBase, audience: 'alumni' }),
    400,
    'VALIDATION_FAILED',
    'audience'
  )
  expectStatus(
    'AN',
    'Validation',
    'Classes audience with no class or section',
    await aPost({ ...aBase, audience: 'classes' }),
    400,
    'VALIDATION_FAILED',
    'class_ids'
  )
  expectStatus(
    'AN',
    'Validation',
    'Publish time in the past',
    await aPost({ ...aBase, publish_at: ist(-60) }),
    400,
    'VALIDATION_FAILED',
    'publish_at'
  )
  expectStatus(
    'AN',
    'Validation',
    'Expiry before it goes out',
    await aPost({ ...aBase, publish_at: ist(120), expires_at: ist(60) }),
    400,
    'VALIDATION_FAILED',
    'expires_at'
  )
  expectStatus(
    'AN',
    'Validation',
    'A section that does not exist this year',
    await aPost({ ...aBase, audience: 'classes', section_ids: [999999] }),
    400,
    'VALIDATION_FAILED',
    'section_ids'
  )
  expectStatus(
    'AN',
    'Validation',
    'Unknown field',
    await aPost({ ...aBase, pinned: true }),
    400,
    'VALIDATION_FAILED'
  )
  expectStatus(
    'AN',
    'Security',
    'Transport in-charge (no announcements permission) cannot read them',
    await call('GET', '/admin/announcements', { token: transport.token }),
    403,
    'FORBIDDEN'
  )
  expectStatus(
    'AN',
    'Security',
    'A teacher cannot write announcements',
    await call('POST', '/admin/announcements', { token: teacher.token, body: aBase }),
    403,
    'FORBIDDEN'
  )
  expectStatus(
    'AN',
    'Security',
    'No token on /me/announcements',
    await call('GET', '/me/announcements'),
    401,
    'TOKEN_MISSING'
  )
  const aIns = await call('GET', '/admin/announcements/insights', { token: admin.token })
  record(
    'AN',
    'Functional',
    'Insights count published, archived and urgent ones',
    aIns.status === 200 &&
      aIns.data.published >= 2 &&
      aIns.data.archived >= 1 &&
      aIns.data.urgent_live >= 1,
    JSON.stringify(aIns.data),
    'published ≥ 2, archived ≥ 1, urgent ≥ 1'
  )
  await db.query(`UPDATE announcements SET academic_year_id = $2 WHERE id = $1`, [
    classOnly.data.id,
    oldYear.id,
  ])
  record(
    'AN',
    'Academic year',
    'An announcement from an earlier academic year is hidden everywhere',
    !(
      await call('GET', '/admin/announcements', { token: admin.token, query: { limit: 100 } })
    ).data.items.some((a) => a.id === classOnly.data.id) &&
      !(await call('GET', '/me/announcements', { token: parent.token })).data.items.some(
        (a) => a.id === classOnly.data.id
      ),
    undefined,
    'Not listed'
  )

  // ---------------- Chat ----------------
  await call('PATCH', '/admin/school', {
    token: admin.token,
    body: { chat_office_start: '00:00', chat_office_end: '23:59' },
  })
  const tThread = await call('POST', '/mobile/teacher/chat/threads', {
    token: teacher.token,
    body: { student_id: child.id, parent_user_id: parent.user.id },
  })
  record(
    'CH',
    'Functional',
    'Teacher opens a conversation with the parent',
    tThread.status === 200 &&
      tThread.data.other.id === parent.user.id &&
      tThread.data.academic_year.id === year.id,
    describe(tThread),
    '200, other = parent, current year'
  )
  const pThread = await call('POST', `/mobile/parent/children/${child.id}/chat/threads`, {
    token: parent.token,
    body: { teacher_user_id: teacher.user.id },
  })
  record(
    'CH',
    'Functional',
    'Parent opening it reaches the same conversation',
    pThread.data?.id === tThread.data.id,
    `${pThread.data?.id} = ${tThread.data.id}`,
    'Same thread'
  )
  const threadId = tThread.data.id
  const msg1 = await call('POST', `/mobile/teacher/chat/threads/${threadId}/messages`, {
    token: teacher.token,
    body: { body: 'D8: Kavin did well in the test today.' },
  })
  record(
    'CH',
    'Functional',
    'Teacher sends a message',
    msg1.status === 201 && msg1.data.sender_party === 'teacher' && !msg1.data.held_for_office_hours,
    describe(msg1),
    '201, not held'
  )
  lastCall = { method: 'WS', path: '/comm chat.message' }
  record(
    'CH',
    'Realtime',
    'The parent app receives it live (chat.message)',
    Boolean(await seen(parentLive, 'chat.message', (p) => p.id === msg1.data.id)),
    undefined,
    'Event received'
  )
  record(
    'CH',
    'Functional',
    'The parent gets a CHAT_MESSAGE push',
    (await notified('CHAT_MESSAGE', parent.user.id, start)) >= 1,
    undefined,
    'Push sent'
  )
  const pThreads = await call('GET', '/mobile/parent/chat/threads', { token: parent.token })
  record(
    'CH',
    'Functional',
    'Parent conversation list shows 1 unread',
    pThreads.data.items.find((t) => t.id === threadId)?.unread === 1,
    `unread=${pThreads.data.items.find((t) => t.id === threadId)?.unread}`,
    'unread 1'
  )
  const readRes = await call('POST', `/mobile/parent/chat/threads/${threadId}/read`, {
    token: parent.token,
  })
  record(
    'CH',
    'Functional',
    'Parent opens it: read receipt on the teacher message',
    readRes.data.marked === 1 &&
      (
        await call('GET', `/mobile/teacher/chat/threads/${threadId}/messages`, {
          token: teacher.token,
        })
      ).data.items.find((m) => m.id === msg1.data.id)?.read_at,
    `marked=${readRes.data?.marked}`,
    'marked 1, read_at set'
  )
  lastCall = { method: 'WS', path: '/comm chat.read' }
  record(
    'CH',
    'Realtime',
    'The teacher sees the read receipt live (chat.read)',
    Boolean(
      await seen(
        teacherLive,
        'chat.read',
        (p) => p.thread_id === threadId && p.message_ids.includes(msg1.data.id)
      )
    ),
    undefined,
    'Event received'
  )
  parentLive.socket.emit('chat.typing', { thread_id: threadId })
  lastCall = { method: 'WS', path: '/comm chat.typing' }
  record(
    'CH',
    'Realtime',
    'The teacher sees the parent typing (chat.typing)',
    Boolean(
      await seen(
        teacherLive,
        'chat.typing',
        (p) => p.thread_id === threadId && p.user_id === parent.user.id
      )
    ),
    undefined,
    'Event received'
  )
  const msg2 = await call('POST', `/mobile/parent/chat/threads/${threadId}/messages`, {
    token: parent.token,
    body: { body: 'D8: Thank you, we will keep practising.' },
  })
  record(
    'CH',
    'Functional',
    'Parent replies inside office hours: the teacher is told at once',
    msg2.status === 201 &&
      !msg2.data.held_for_office_hours &&
      (await notified('CHAT_MESSAGE', teacher.user.id, start)) >= 1,
    describe(msg2),
    '201, not held, teacher pushed'
  )

  await call('PATCH', '/admin/school', {
    token: admin.token,
    body: { chat_office_start: '00:00', chat_office_end: '00:01' },
  })
  const teacherPushes = await notified('CHAT_MESSAGE', teacher.user.id, start)
  const held = await call('POST', `/mobile/parent/chat/threads/${threadId}/messages`, {
    token: parent.token,
    body: { body: 'D8: Sent after office hours.' },
  })
  const holdRow = await one(`SELECT push_pending, push_after FROM chat_messages WHERE id = $1`, [
    held.data.id,
  ])
  record(
    'CH',
    'Functional',
    'Outside office hours the message is saved and held for the teacher',
    held.status === 201 &&
      held.data.held_for_office_hours &&
      holdRow.push_pending &&
      Boolean(holdRow.push_after) &&
      (await notified('CHAT_MESSAGE', teacher.user.id, start)) === teacherPushes,
    `held=${held.data?.held_for_office_hours} until ${holdRow.push_after?.toISOString?.()}`,
    '201 held, no push yet'
  )
  const thread2 = await call('GET', `/mobile/parent/chat/threads/${threadId}`, {
    token: parent.token,
  })
  record(
    'CH',
    'Functional',
    'The parent is shown when office hours start again',
    thread2.data.office_hours.open_now === false && Boolean(thread2.data.office_hours.next_open_at),
    JSON.stringify(thread2.data.office_hours),
    'open_now false with next_open_at'
  )
  const tReply = await call('POST', `/mobile/teacher/chat/threads/${threadId}/messages`, {
    token: teacher.token,
    body: { body: 'D8: Teachers can reply any time.' },
  })
  record(
    'CH',
    'Functional',
    'A teacher message is never held',
    tReply.status === 201 && !tReply.data.held_for_office_hours,
    describe(tReply),
    '201, not held'
  )
  await db.query(
    `UPDATE chat_messages SET push_after = now() - interval '1 minute' WHERE id = $1`,
    [held.data.id]
  )
  lastCall = { method: 'CRON', path: 'chat-office-hours' }
  record(
    'CH',
    'Regression',
    'When office hours start the held message reaches the teacher',
    Boolean(
      await waitFor(
        async () =>
          !(await one(`SELECT push_pending FROM chat_messages WHERE id = $1`, [held.data.id]))
            .push_pending &&
          (await notified('CHAT_MESSAGE', teacher.user.id, start)) > teacherPushes
      )
    ),
    undefined,
    'push_pending false, teacher pushed'
  )
  await call('PATCH', '/admin/school', {
    token: admin.token,
    body: { chat_office_start: '08:00', chat_office_end: '17:00' },
  })

  const page1 = await call('GET', `/mobile/teacher/chat/threads/${threadId}/messages`, {
    token: teacher.token,
    query: { limit: 2 },
  })
  const page2 = await call('GET', `/mobile/teacher/chat/threads/${threadId}/messages`, {
    token: teacher.token,
    query: { limit: 2, before_id: page1.data.items.at(-1).id },
  })
  record(
    'CH',
    'Functional',
    'History loads newest first and pages back with before_id',
    page1.data.items.length === 2 &&
      page1.data.has_more &&
      page2.data.items.every((m) => m.id < page1.data.items.at(-1).id),
    `page1=${page1.data.items.map((m) => m.id)} page2=${page2.data.items.map((m) => m.id)}`,
    'Older messages on page 2'
  )
  const flag = await call(
    'POST',
    `/mobile/teacher/chat/threads/${threadId}/messages/${msg2.data.id}/flag`,
    { token: teacher.token, body: { reason: 'D8 test report' } }
  )
  record(
    'CH',
    'Functional',
    'Teacher reports a parent message to the office',
    flag.status === 200 && flag.data.flagged,
    describe(flag),
    '200 flagged'
  )
  expectStatus(
    'CH',
    'Validation',
    'Reporting your own message is refused',
    await call('POST', `/mobile/teacher/chat/threads/${threadId}/messages/${msg1.data.id}/flag`, {
      token: teacher.token,
      body: { reason: 'x' },
    }),
    400,
    'OWN_MESSAGE'
  )
  expectStatus(
    'CH',
    'Validation',
    'Reporting twice is refused',
    await call('POST', `/mobile/teacher/chat/threads/${threadId}/messages/${msg2.data.id}/flag`, {
      token: teacher.token,
      body: { reason: 'x' },
    }),
    409,
    'ALREADY_FLAGGED'
  )
  const flaggedThreads = await call('GET', '/admin/chat/threads', {
    token: admin.token,
    query: { flagged: true },
  })
  const flaggedList = await call('GET', '/admin/chat/flagged', { token: admin.token })
  record(
    'CH',
    'Functional',
    'The office sees the reported conversation and message',
    flaggedThreads.data.items.some((t) => t.id === threadId) &&
      flaggedList.data.items.some((m) => m.id === msg2.data.id),
    `threads=${flaggedThreads.data?.total} flagged=${flaggedList.data?.total}`,
    'Both listed'
  )
  const audit = await call('GET', `/admin/chat/threads/${threadId}`, { token: admin.token })
  record(
    'CH',
    'Functional',
    'Opening the transcript is recorded in the audit trail',
    audit.status === 200 &&
      audit.data.messages.length >= 4 &&
      audit.data.audit.some((a) => a.action === 'viewed_thread' && a.actor.id === admin.user.id),
    `messages=${audit.data?.messages?.length}`,
    'viewed_thread logged'
  )
  expectStatus(
    'CH',
    'Validation',
    'Hiding needs a reason',
    await call('POST', `/admin/chat/messages/${msg2.data.id}/hide`, {
      token: admin.token,
      body: {},
    }),
    400,
    'VALIDATION_FAILED',
    'reason'
  )
  const hiddenMsg = await call('POST', `/admin/chat/messages/${msg2.data.id}/hide`, {
    token: admin.token,
    body: { reason: 'D8 hide' },
  })
  const memberView = (
    await call('GET', `/mobile/parent/chat/threads/${threadId}/messages`, { token: parent.token })
  ).data.items.find((m) => m.id === msg2.data.id)
  record(
    'CH',
    'Functional',
    'Hidden: both people see it as removed; the office still sees the text',
    hiddenMsg.status === 200 &&
      hiddenMsg.data.original_body?.includes('Thank you') &&
      memberView.hidden &&
      memberView.body === null,
    describe(hiddenMsg),
    'Member body null, office has original'
  )
  lastCall = { method: 'WS', path: '/comm chat.updated' }
  record(
    'CH',
    'Realtime',
    'The parent app updates the hidden message live (chat.updated)',
    Boolean(await seen(parentLive, 'chat.updated', (p) => p.id === msg2.data.id && p.hidden)),
    undefined,
    'Event received'
  )
  const unhid = await call('POST', `/admin/chat/messages/${msg2.data.id}/unhide`, {
    token: admin.token,
  })
  record(
    'CH',
    'Functional',
    'The office can show it again',
    unhid.status === 200 && !unhid.data.hidden,
    describe(unhid),
    '200 shown'
  )
  const flag2 = await call(
    'POST',
    `/mobile/parent/chat/threads/${threadId}/messages/${tReply.data.id}/flag`,
    { token: parent.token, body: { reason: 'D8 second report' } }
  )
  const dismissed = await call('POST', `/admin/chat/messages/${tReply.data.id}/dismiss-flag`, {
    token: admin.token,
  })
  record(
    'CH',
    'Functional',
    'The office closes a report without hiding the message',
    flag2.status === 200 &&
      dismissed.status === 200 &&
      !dismissed.data.flagged &&
      !dismissed.data.hidden,
    describe(dismissed),
    '200, not flagged, not hidden'
  )
  const cIns = await call('GET', '/admin/chat/insights', { token: admin.token })
  record(
    'CH',
    'Functional',
    'Chat insights count conversations and today’s messages',
    cIns.status === 200 && cIns.data.threads >= 1 && cIns.data.messages_today >= 4,
    JSON.stringify(cIns.data),
    'threads ≥ 1, messages_today ≥ 4'
  )
  const cSend = (body) =>
    call('POST', `/mobile/parent/chat/threads/${threadId}/messages`, { token: parent.token, body })
  expectStatus(
    'CH',
    'Validation',
    'Empty message (no text, no file)',
    await cSend({ body: '   ' }),
    400,
    'VALIDATION_FAILED',
    'body'
  )
  expectStatus(
    'CH',
    'Validation',
    'Message longer than 2000 characters',
    await cSend({ body: 'x'.repeat(2001) }),
    400,
    'VALIDATION_FAILED',
    'body'
  )
  expectStatus(
    'CH',
    'Validation',
    'Unknown field',
    await cSend({ body: 'hi', urgent: true }),
    400,
    'VALIDATION_FAILED'
  )
  expectStatus(
    'CH',
    'Validation',
    'Reporting without a reason',
    await call('POST', `/mobile/parent/chat/threads/${threadId}/messages/${tReply.data.id}/flag`, {
      token: parent.token,
      body: {},
    }),
    400,
    'VALIDATION_FAILED',
    'reason'
  )
  expectStatus(
    'CH',
    'Validation',
    'Office hours that end before they start',
    await call('PATCH', '/admin/school', {
      token: admin.token,
      body: { chat_office_start: '17:00', chat_office_end: '08:00' },
    }),
    400,
    'VALIDATION_FAILED',
    'chat_office_end'
  )
  expectStatus(
    'CH',
    'Validation',
    'Parent chats with someone who does not teach the child',
    await call('POST', `/mobile/parent/children/${child.id}/chat/threads`, {
      token: parent.token,
      body: { teacher_user_id: transport.user.id },
    }),
    400,
    'VALIDATION_FAILED',
    'teacher_user_id'
  )
  expectStatus(
    'CH',
    'Security',
    'Another parent cannot read this conversation',
    await call('GET', `/mobile/parent/chat/threads/${threadId}/messages`, { token: other.token }),
    404,
    'THREAD_NOT_FOUND'
  )
  expectStatus(
    'CH',
    'Security',
    'A teacher cannot use the chat audit',
    await call('GET', '/admin/chat/threads', { token: teacher.token }),
    403,
    'FORBIDDEN'
  )
  expectStatus(
    'CH',
    'Security',
    'Transport in-charge cannot use the chat audit',
    await call('GET', '/admin/chat/threads', { token: transport.token }),
    403,
    'FORBIDDEN'
  )
  expectStatus(
    'CH',
    'Security',
    'No token on chat',
    await call('GET', '/mobile/parent/chat/threads'),
    401,
    'TOKEN_MISSING'
  )
  await db.query(`UPDATE chat_threads SET academic_year_id = $2 WHERE id = $1`, [
    threadId,
    oldYear.id,
  ])
  record(
    'CH',
    'Academic year',
    'A conversation from an earlier academic year is hidden from both apps and the office',
    !(await call('GET', '/mobile/parent/chat/threads', { token: parent.token })).data.items.some(
      (t) => t.id === threadId
    ) &&
      !(await call('GET', '/admin/chat/threads', { token: admin.token })).data.items.some(
        (t) => t.id === threadId
      ),
    undefined,
    'Not listed'
  )
  await db.query(`UPDATE chat_threads SET academic_year_id = $2 WHERE id = $1`, [threadId, year.id])
}

function save() {
  fs.writeFileSync(
    OUT,
    JSON.stringify({ run_at: new Date().toISOString(), api: API, day: DAY, results }, null, 2)
  )
}

main()
  .catch((error) => {
    console.error('RUNNER ERROR', error)
    process.exitCode = 1
  })
  .finally(async () => {
    sockets.forEach((socket) => socket.close())
    agoraMock.close()
    await restoreYear().catch(() => null)
    await db.end().catch(() => null)
    save()
    const failed = results.filter((row) => row.status === 'Fail').length
    console.log(
      `\n${results.length - failed}/${results.length} Day 8 API checks passed. Results: e2e/results/day8-api.json`
    )
    process.exit(failed || process.exitCode ? 1 : 0)
  })
