import fs from 'node:fs'
import path from 'node:path'

const API = process.env.E2E_API_URL ?? 'http://localhost:3000/api/v1'
const DAY = process.env.E2E_DAY ?? 'Day 3'
const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const OUT = path.join(ROOT, 'results')
fs.mkdirSync(OUT, { recursive: true })
const RUN = String(Date.now()).slice(-5)
const mobile = (n) => `97${RUN}${String(n).padStart(3, '0')}`
const results = []

function tokenFrom(stateFile) {
  const file = path.join(ROOT, stateFile)
  if (!fs.existsSync(file)) return null
  const state = JSON.parse(fs.readFileSync(file, 'utf8'))
  const entry = state.origins
    .flatMap((origin) => origin.localStorage)
    .find((item) => item.name === 'tz-session')
  return entry ? JSON.parse(entry.value) : null
}

function saveSession(stateFile, tokens) {
  const file = path.join(ROOT, stateFile)
  const value = JSON.stringify({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  })
  const state = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8'))
    : { cookies: [], origins: [] }
  const origin = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:5173').origin
  let entry = state.origins.find((item) => item.origin === origin)
  if (!entry) {
    entry = { origin, localStorage: [] }
    state.origins.push(entry)
  }
  entry.localStorage = entry.localStorage
    .filter((item) => item.name !== 'tz-session')
    .concat({ name: 'tz-session', value })
  fs.writeFileSync(file, JSON.stringify(state, null, 2))
}

async function sessionFor(stateFile, mobileNumber) {
  const saved = tokenFrom(stateFile)
  if (saved) {
    const refreshed = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: saved.refreshToken }),
    }).then((response) => response.json())
    if (refreshed.data) {
      saveSession(stateFile, refreshed.data)
      return refreshed.data.access_token
    }
  }
  await fetch(`${API}/auth/otp/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mobile: mobileNumber }),
  })
  const verified = await fetch(`${API}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      mobile: mobileNumber,
      otp: '123456',
      client: { app: 'admin', platform: 'web' },
    }),
  }).then((response) => response.json())
  if (!verified.data) throw new Error(`Sign-in failed for ${mobileNumber}: ${verified.message}`)
  saveSession(stateFile, verified.data)
  return verified.data.access_token
}

const client = (token) => async (method, url, body) => {
  const response = await fetch(`${API}${url}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const type = response.headers.get('content-type') ?? ''
  return {
    status: response.status,
    type,
    body: type.includes('json') ? await response.json() : null,
  }
}

async function check(meta, fn) {
  const row = { ...meta, day: DAY, status: 'Pass', actual: '' }
  try {
    row.actual = (await fn()) ?? meta.expected
  } catch (error) {
    row.status = 'Fail'
    row.actual = String(error?.message ?? error).slice(0, 300)
  }
  results.push(row)
  console.log(
    `${row.status === 'Pass' ? 'PASS' : 'FAIL'}  ${meta.id.padEnd(8)} ${meta.method.padEnd(6)} ${meta.endpoint}${row.status === 'Fail' ? `\n        ${row.actual}` : ''}`
  )
}

const expectStatus = (result, status, code) => {
  if (result.status !== status)
    throw new Error(
      `Got ${result.status} ${result.body?.error ?? ''}: ${result.body?.message ?? ''}`
    )
  if (code && result.body?.error !== code)
    throw new Error(`Got ${result.body?.error}, wanted ${code}`)
  return `${result.status}${result.body?.error ? ` ${result.body.error}` : ''}${result.body?.message && status >= 400 ? `: ${result.body.message}` : ''}`
}

const fields = (result) => (result.body?.errors ?? []).map((item) => item.field)
const expectFields = (result, wanted) => {
  expectStatus(result, 400, 'VALIDATION_FAILED')
  const got = fields(result)
  const missing = wanted.filter(
    (field) => !got.some((item) => item === field || item.startsWith(`${field}.`))
  )
  if (missing.length) throw new Error(`No error for ${missing.join(', ')} (got ${got.join(', ')})`)
  return `400 VALIDATION_FAILED on ${wanted.join(', ')}`
}

const admin = client(await sessionFor('.auth-admin.json', '9876543210'))
const guest = client(null)
const parent = client(await sessionFor('.auth-parent.json', '9000000005'))
const teacher = client(await sessionFor('.auth-teacher.json', '9000000004'))

const C = (id, module, method, endpoint, scenario, expected, fn) =>
  check({ id, module, method, endpoint, scenario, expected }, fn)

await C(
  'API-AU-01',
  'Auth',
  'POST',
  '/auth/otp/request',
  'Mobile missing',
  '400 on mobile',
  async () => expectFields(await guest('POST', '/auth/otp/request', {}), ['mobile'])
)
await C(
  'API-AU-02',
  'Auth',
  'POST',
  '/auth/otp/request',
  'Number not in school records',
  '404 MOBILE_NOT_REGISTERED',
  async () =>
    expectStatus(
      await guest('POST', '/auth/otp/request', { mobile: '9123400001' }),
      404,
      'MOBILE_NOT_REGISTERED'
    )
)
await C('API-AU-03', 'Auth', 'GET', '/admin/students', 'No token', '401', async () =>
  expectStatus(await guest('GET', '/admin/students'), 401)
)
await C(
  'API-AU-04',
  'Auth',
  'GET',
  '/admin/students',
  'Parent token on admin API',
  '403',
  async () => expectStatus(await parent('GET', '/admin/students'), 403)
)

await C(
  'API-US-01',
  'Users',
  'POST',
  '/admin/users',
  'Empty body',
  '400 on name, mobile, role_codes',
  async () =>
    expectFields(await admin('POST', '/admin/users', {}), ['name', 'mobile', 'role_codes'])
)
let userId = 0
await C('API-US-02', 'Users', 'POST', '/admin/users', 'Create a teacher user', '201', async () => {
  const result = await admin('POST', '/admin/users', {
    name: `API User ${RUN}`,
    mobile: mobile(1),
    role_codes: ['TEACHER'],
  })
  userId = result.body?.data?.id
  return expectStatus(result, 201)
})
await C(
  'API-US-03',
  'Users',
  'POST',
  '/admin/users',
  'Same mobile again',
  '409 MOBILE_TAKEN',
  async () =>
    expectStatus(
      await admin('POST', '/admin/users', {
        name: 'Dup',
        mobile: mobile(1),
        role_codes: ['TEACHER'],
      }),
      409,
      'MOBILE_TAKEN'
    )
)
await C(
  'API-US-04',
  'Users',
  'GET',
  '/admin/users?sort=bad',
  'Unknown sort',
  '400 INVALID_SORT',
  async () => expectStatus(await admin('GET', '/admin/users?sort=bad'), 400, 'INVALID_SORT')
)

await C(
  'API-SU-01',
  'School setup',
  'POST',
  '/admin/subjects',
  'Empty body',
  '400 on code, name',
  async () => expectFields(await admin('POST', '/admin/subjects', {}), ['code', 'name'])
)
await C(
  'API-SU-02',
  'School setup',
  'POST',
  '/admin/holidays',
  'Last day before first day',
  '400',
  async () => {
    const result = await admin('POST', '/admin/holidays', {
      name: 'Bad',
      date: '2026-12-10',
      end_date: '2026-12-01',
      type: 'holiday',
    })
    if (result.status !== 400) throw new Error(`Got ${result.status}`)
    return `400 ${result.body.error}`
  }
)
await C(
  'API-SU-03',
  'School setup',
  'GET',
  '/admin/setup/summary',
  'Setup summary',
  '200 with current year',
  async () => {
    const result = await admin('GET', '/admin/setup/summary')
    if (!result.body?.data?.current_year) throw new Error('No current year')
    return expectStatus(result, 200)
  }
)

await C(
  'API-ST-01',
  'Students',
  'POST',
  '/admin/students',
  'Empty body',
  '400 on first_name, dob, gender, class_id, guardians',
  async () =>
    expectFields(await admin('POST', '/admin/students', {}), [
      'first_name',
      'dob',
      'gender',
      'class_id',
      'guardians',
    ])
)
await C(
  'API-ST-02',
  'Students',
  'POST',
  '/admin/students',
  'Guardian with bad mobile',
  '400 on guardians.0.mobile',
  async () =>
    expectFields(
      await admin('POST', '/admin/students', {
        first_name: 'X',
        dob: '2015-01-01',
        gender: 'male',
        class_id: 1,
        guardians: [{ name: 'Parent', mobile: '123', relation: 'father' }],
      }),
      ['guardians']
    )
)
const classes = (await admin('GET', '/admin/classes')).body.data
const classFive = classes.find((item) => item.name === '5')
let studentId = 0
await C(
  'API-ST-03',
  'Students',
  'POST',
  '/admin/students',
  'Create a student with a new parent',
  '201 with admission number',
  async () => {
    const result = await admin('POST', '/admin/students', {
      first_name: 'APIKid',
      last_name: RUN,
      dob: '2016-05-10',
      gender: 'female',
      class_id: classFive.id,
      guardians: [
        {
          name: `API Parent ${RUN}`,
          mobile: mobile(2),
          relation: 'mother',
          receives_alerts: false,
        },
      ],
    })
    studentId = result.body?.data?.id
    if (!result.body?.data?.admission_no) throw new Error('No admission number')
    return expectStatus(result, 201)
  }
)
await C(
  'API-ST-04',
  'Students',
  'GET',
  '/admin/students?search=',
  'Search by parent mobile',
  'The new student is found',
  async () => {
    const result = await admin('GET', `/admin/students?search=${mobile(2)}`)
    if (!result.body.data.items.some((item) => item.id === studentId)) throw new Error('Not found')
    return expectStatus(result, 200)
  }
)
await C(
  'API-ST-05',
  'Students',
  'PUT',
  '/admin/students/:id/enrollment',
  'Roll number without a section',
  '400 ROLL_NEEDS_SECTION',
  async () =>
    expectStatus(
      await admin('PUT', `/admin/students/${studentId}/enrollment`, {
        class_id: classFive.id,
        section_id: null,
        roll_no: 3,
      }),
      400,
      'ROLL_NEEDS_SECTION'
    )
)

await C(
  'API-RC-01',
  'Student records',
  'PUT',
  '/admin/students/:id/health',
  'Height out of range',
  '400 on height_cm',
  async () =>
    expectFields(await admin('PUT', `/admin/students/${studentId}/health`, { height_cm: 999 }), [
      'height_cm',
    ])
)
await C(
  'API-RC-02',
  'Student records',
  'PUT',
  '/admin/students/:id/health',
  'Save height and weight',
  '200 with BMI',
  async () => {
    const result = await admin('PUT', `/admin/students/${studentId}/health`, {
      height_cm: 135,
      weight_kg: 30,
    })
    if (result.body?.data?.bmi !== 16.5) throw new Error(`BMI ${result.body?.data?.bmi}`)
    return expectStatus(result, 200)
  }
)
await C(
  'API-RC-03',
  'Student records',
  'POST',
  '/admin/students/:id/vaccinations',
  'Vaccine name missing',
  '400 on vaccine',
  async () =>
    expectFields(await admin('POST', `/admin/students/${studentId}/vaccinations`, {}), ['vaccine'])
)
await C(
  'API-RC-04',
  'Student records',
  'POST',
  '/admin/students/:id/behaviour',
  'Unknown category and short title',
  '400 on category, title',
  async () =>
    expectFields(
      await admin('POST', `/admin/students/${studentId}/behaviour`, {
        category: 'praise',
        title: 'ok',
      }),
      ['category', 'title']
    )
)
await C(
  'API-RC-05',
  'Student records',
  'POST',
  '/admin/students/:id/documents',
  'File id that does not exist',
  '400 on file_id',
  async () =>
    expectFields(
      await admin('POST', `/admin/students/${studentId}/documents`, {
        type: 'aadhaar',
        file_id: 99999999,
      }),
      ['file_id']
    )
)
await C(
  'API-RC-06',
  'Student records',
  'POST',
  '/admin/students/:id/documents/:doc/verify',
  'Reject without a reason',
  '400 on remarks',
  async () =>
    expectFields(
      await admin('POST', `/admin/students/${studentId}/documents/1/verify`, {
        status: 'rejected',
      }),
      ['remarks']
    )
)

await C(
  'API-LC-01',
  'ID card and TC',
  'GET',
  '/admin/students/:id/id-card',
  'ID card PDF',
  '200 application/pdf',
  async () => {
    const result = await admin('GET', `/admin/students/${studentId}/id-card`)
    if (!result.type.includes('pdf')) throw new Error(`Type ${result.type}`)
    return '200 application/pdf'
  }
)
await C(
  'API-LC-02',
  'ID card and TC',
  'GET',
  '/admin/id-cards',
  'No class or section',
  '400 on section_id',
  async () => expectFields(await admin('GET', '/admin/id-cards'), ['section_id'])
)
await C(
  'API-LC-03',
  'ID card and TC',
  'POST',
  '/admin/id-cards/verify',
  'Tampered QR',
  '400 QR_INVALID',
  async () =>
    expectStatus(
      await admin('POST', '/admin/id-cards/verify', { token: 'TZS1.1.1.AAAAAAAAAAAAAAAAAAAAAA' }),
      400,
      'QR_INVALID'
    )
)
await C(
  'API-LC-04',
  'ID card and TC',
  'POST',
  '/admin/id-cards/verify',
  'Real QR from the digital ID',
  '200 with the student',
  async () => {
    const digital = await admin('GET', `/admin/students/${studentId}/digital-id`)
    const result = await admin('POST', '/admin/id-cards/verify', {
      token: digital.body.data.qr_token,
    })
    if (result.body?.data?.student_id !== studentId) throw new Error('Wrong student')
    return expectStatus(result, 200)
  }
)
await C(
  'API-LC-05',
  'ID card and TC',
  'POST',
  '/admin/students/:id/exit',
  'Reason missing',
  '400 on reason',
  async () =>
    expectFields(
      await admin('POST', `/admin/students/${studentId}/exit`, {
        exit_type: 'transferred',
        leaving_date: '2026-11-02',
      }),
      ['reason']
    )
)
await C(
  'API-LC-06',
  'ID card and TC',
  'POST',
  '/admin/students/:id/exit',
  'Transfer with TC',
  '201 with TC number',
  async () => {
    const result = await admin('POST', `/admin/students/${studentId}/exit`, {
      exit_type: 'transferred',
      leaving_date: '2026-11-02',
      reason: 'API test',
    })
    if (!/-TC-\d{4}-\d{4}$/.test(result.body?.data?.tc_no ?? '')) throw new Error('No TC number')
    return expectStatus(result, 201)
  }
)
await C(
  'API-LC-07',
  'ID card and TC',
  'POST',
  '/admin/students/:id/exit',
  'Exit twice',
  '409 STUDENT_NOT_ACTIVE',
  async () =>
    expectStatus(
      await admin('POST', `/admin/students/${studentId}/exit`, {
        exit_type: 'withdrawn',
        leaving_date: '2026-11-02',
        reason: 'Again',
      }),
      409,
      'STUDENT_NOT_ACTIVE'
    )
)
await C(
  'API-LC-08',
  'ID card and TC',
  'GET',
  '/admin/promotions/preview',
  'Preview class 6',
  '200 with next year 2027-28',
  async () => {
    const six = classes.find((item) => item.name === '6')
    const result = await admin('GET', `/admin/promotions/preview?class_id=${six.id}`)
    if (result.body?.data?.to_year?.name !== '2027-28')
      throw new Error(`Next year ${result.body?.data?.to_year?.name}`)
    return expectStatus(result, 200)
  }
)

await C(
  'API-SF-01',
  'Staff',
  'POST',
  '/admin/staff',
  'Empty body',
  '400 on name, mobile, role_codes, staff_type, designation',
  async () =>
    expectFields(await admin('POST', '/admin/staff', {}), [
      'name',
      'mobile',
      'role_codes',
      'staff_type',
      'designation',
    ])
)
let staffId = 0
await C(
  'API-SF-02',
  'Staff',
  'POST',
  '/admin/staff',
  'Create a teacher',
  '201 with employee number',
  async () => {
    const result = await admin('POST', '/admin/staff', {
      name: `API Teacher ${RUN}`,
      mobile: mobile(3),
      role_codes: ['TEACHER'],
      staff_type: 'teaching',
      designation: 'BT Assistant',
      send_invite: false,
    })
    staffId = result.body?.data?.id
    if (!/-EMP-\d{4}$/.test(result.body?.data?.employee_no ?? ''))
      throw new Error('No employee number')
    return expectStatus(result, 201)
  }
)
await C(
  'API-SF-03',
  'Staff',
  'POST',
  '/admin/staff',
  'Same person twice',
  '409 STAFF_EXISTS',
  async () =>
    expectStatus(
      await admin('POST', '/admin/staff', {
        name: 'Dup',
        mobile: mobile(3),
        role_codes: ['TEACHER'],
        staff_type: 'teaching',
        designation: 'BT Assistant',
      }),
      409,
      'STAFF_EXISTS'
    )
)
await C(
  'API-SF-04',
  'Staff',
  'PUT',
  '/admin/staff/:id/bank',
  'Bad IFSC and account number',
  '400 on ifsc, account_no',
  async () =>
    expectFields(
      await admin('PUT', `/admin/staff/${staffId}/bank`, {
        account_holder: 'A',
        bank_name: 'B',
        ifsc: 'BAD',
        account_no: '12',
      }),
      ['ifsc', 'account_no']
    )
)
await C(
  'API-SF-05',
  'Staff',
  'PUT',
  '/admin/staff/:id/bank',
  'Save bank details',
  '200, only last 4 digits returned',
  async () => {
    const result = await admin('PUT', `/admin/staff/${staffId}/bank`, {
      account_holder: 'API Teacher',
      bank_name: 'Indian Bank',
      ifsc: 'IDIB000A045',
      account_no: '6012349876',
    })
    if (result.body?.data?.bank?.account_masked !== 'XXXX9876') throw new Error('Not masked')
    if (JSON.stringify(result.body).includes('6012349876')) throw new Error('Full number leaked')
    return expectStatus(result, 200)
  }
)
await C(
  'API-SF-06',
  'Staff',
  'GET',
  '/admin/staff/insights',
  'Teacher insight cards',
  '200 with four numbers',
  async () => {
    const result = await admin('GET', '/admin/staff/insights')
    for (const key of ['total_teachers', 'average_load', 'class_teachers', 'need_attention']) {
      if (typeof result.body?.data?.[key] !== 'number') throw new Error(`Missing ${key}`)
    }
    return expectStatus(result, 200)
  }
)
await C(
  'API-SF-07',
  'Staff',
  'PUT',
  '/admin/teacher-assignments',
  'Non-teacher as teacher',
  '400 NOT_A_TEACHER',
  async () => {
    const matrix = (await admin('GET', '/admin/teacher-assignments')).body.data
    const row = matrix.rows.find((item) => item.cells.length)
    return expectStatus(
      await admin('PUT', '/admin/teacher-assignments', {
        items: [
          { section_id: row.section_id, subject_id: row.cells[0].subject_id, teacher_user_id: 1 },
        ],
      }),
      400,
      'NOT_A_TEACHER'
    )
  }
)
await C(
  'API-SF-08',
  'Staff',
  'DELETE',
  '/admin/staff/:id',
  'Remove the test teacher',
  '200',
  async () => expectStatus(await admin('DELETE', `/admin/staff/${staffId}`), 200)
)

await C(
  'API-MP-01',
  'Mobile Parent',
  'GET',
  '/mobile/parent/children',
  'Parent sees own children',
  '200 with Kavin and Nila',
  async () => {
    const result = await parent('GET', '/mobile/parent/children')
    if (result.body?.data?.length < 2) throw new Error('Children missing')
    return expectStatus(result, 200)
  }
)
await C(
  'API-MP-02',
  'Mobile Parent',
  'GET',
  '/mobile/parent/children/:id',
  'Another family’s child',
  '404 CHILD_NOT_FOUND',
  async () =>
    expectStatus(
      await parent('GET', `/mobile/parent/children/${studentId}`),
      404,
      'CHILD_NOT_FOUND'
    )
)
await C(
  'API-MP-03',
  'Mobile Parent',
  'GET',
  '/mobile/parent/children/:id/behaviour',
  'Staff-only notes hidden',
  'Only visible notes',
  async () => {
    const kid = (await parent('GET', '/mobile/parent/children')).body.data[0]
    const result = await parent('GET', `/mobile/parent/children/${kid.id}/behaviour`)
    if (result.body.data.some((note) => note.visible_to_parent === false))
      throw new Error('Staff-only note leaked')
    return expectStatus(result, 200)
  }
)
await C(
  'API-MT-01',
  'Mobile Teacher',
  'GET',
  '/mobile/teacher/classes',
  'Teacher sees own sections',
  '200, 6-A first as class teacher',
  async () => {
    const result = await teacher('GET', '/mobile/teacher/classes')
    if (!result.body?.data?.[0]?.is_class_teacher)
      throw new Error('Class teacher section not first')
    return expectStatus(result, 200)
  }
)
await C(
  'API-MT-02',
  'Mobile Teacher',
  'GET',
  '/mobile/teacher/students/:id',
  'Student outside own sections',
  '403 or 404',
  async () => {
    const result = await teacher('GET', `/mobile/teacher/students/${studentId}`)
    if (![403, 404].includes(result.status)) throw new Error(`Got ${result.status}`)
    return `${result.status} ${result.body.error}`
  }
)
await C(
  'API-MT-03',
  'Mobile Teacher',
  'GET',
  '/mobile/teacher/classes',
  'Parent calling teacher API',
  '403',
  async () => expectStatus(await parent('GET', '/mobile/teacher/classes'), 403)
)

await C(
  'API-FL-01',
  'Bus tracking',
  'GET',
  '/admin/fleet/live',
  'Live bus status through the School API',
  '200 with totals and vehicles',
  async () => {
    const result = await admin('GET', '/admin/fleet/live')
    if (!Array.isArray(result.body?.data?.vehicles)) throw new Error('No vehicles list')
    return expectStatus(result, 200)
  }
)
await C(
  'API-FL-02',
  'Bus tracking',
  'GET',
  '/admin/fleet/vehicles/:id',
  'Unknown vehicle',
  '404',
  async () => expectStatus(await admin('GET', '/admin/fleet/vehicles/999999'), 404)
)
await C('API-FL-03', 'Bus tracking', 'GET', '/admin/fleet/live', 'Parent token', '403', async () =>
  expectStatus(await parent('GET', '/admin/fleet/live'), 403)
)
const TELEMATICS = process.env.E2E_TELEMATICS_URL ?? 'http://localhost:3001/api'
await C(
  'API-TS-01',
  'Telematics service',
  'GET',
  ':3001/api/health',
  'Health without a key',
  '200 with db and mqtt',
  async () => {
    const response = await fetch(`${TELEMATICS}/health`)
    const body = await response.json()
    if (body?.data?.db !== 'up') throw new Error(`db ${body?.data?.db}`)
    return `${response.status} db ${body.data.db}, mqtt ${body.data.mqtt}`
  }
)
await C(
  'API-TS-02',
  'Telematics service',
  'GET',
  ':3001/api/v1/devices/live',
  'No API key',
  '401 API_KEY_MISSING',
  async () => {
    const response = await fetch(`${TELEMATICS}/v1/devices/live`)
    const body = await response.json()
    if (response.status !== 401 || body.error !== 'API_KEY_MISSING')
      throw new Error(`${response.status} ${body.error}`)
    return '401 API_KEY_MISSING'
  }
)
await C(
  'API-TS-03',
  'Telematics service',
  'GET',
  ':3001/api/v1/devices/live',
  'Wrong API key',
  '401 API_KEY_INVALID',
  async () => {
    const response = await fetch(`${TELEMATICS}/v1/devices/live`, {
      headers: { 'x-api-key': 'x'.repeat(40) },
    })
    const body = await response.json()
    if (response.status !== 401 || body.error !== 'API_KEY_INVALID')
      throw new Error(`${response.status} ${body.error}`)
    return '401 API_KEY_INVALID'
  }
)

await admin('DELETE', `/admin/students/${studentId}`)
if (userId) await admin('DELETE', `/admin/users/${userId}`)

const passed = results.filter((row) => row.status === 'Pass').length
fs.writeFileSync(
  path.join(OUT, 'api.json'),
  JSON.stringify({ run_at: new Date().toISOString(), api: API, day: DAY, results }, null, 2)
)
console.log(`\n${passed}/${results.length} API checks passed. Results: e2e/results/api.json`)
process.exit(passed === results.length ? 0 : 1)
