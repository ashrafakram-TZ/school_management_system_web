import fs from 'node:fs'
import path from 'node:path'

const API = process.env.E2E_API_URL ?? 'http://localhost:3000/api/v1'
const DAY = process.env.E2E_DAY ?? 'Day 6'
const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const OUT = path.join(ROOT, 'results')
fs.mkdirSync(OUT, { recursive: true })
const RUN = String(Date.now()).slice(-5)
const mobile = (n) => `97${RUN}${String(n).padStart(3, '0')}`
const results = []
const TODAY_IST = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)

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

async function sessionFor(stateFile, mobileNumber, app = 'admin') {
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
      client: { app, platform: app === 'admin' ? 'web' : 'android' },
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
  const row = { day: DAY, ...meta, status: 'Pass', actual: '' }
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

const adminToken = await sessionFor('.auth-admin.json', '9876543210')
const admin = client(adminToken)
const guest = client(null)
const parent = client(await sessionFor('.auth-parent.json', '9000000005', 'mobile'))
const teacherToken = await sessionFor('.auth-teacher.json', '9000000004', 'mobile')
const teacher = client(teacherToken)
const ao = client(await sessionFor('.auth-ao.json', '9000000002'))

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
        leaving_date: TODAY_IST,
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
      leaving_date: TODAY_IST,
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
        leaving_date: TODAY_IST,
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

await check(
  {
    id: 'API-ST-20',
    module: 'Students',
    method: 'PATCH',
    endpoint: '/admin/students/:id',
    scenario: 'Save identification marks',
    expected: '200 and the marks come back on the student',
    day: 'Day 4',
  },
  async () => {
    const marks = 'A mole on the left cheek'
    expectStatus(await admin('PATCH', `/admin/students/${studentId}`, { identification_marks: marks }), 200)
    const detail = await admin('GET', `/admin/students/${studentId}`)
    if (detail.body.data.identification_marks !== marks)
      throw new Error(`Got ${detail.body.data.identification_marks}`)
    return '200, identification_marks saved'
  }
)
await check(
  {
    id: 'API-ST-21',
    module: 'Students',
    method: 'PATCH',
    endpoint: '/admin/students/:id',
    scenario: 'Identification marks longer than 255 characters',
    expected: '400 VALIDATION_FAILED on identification_marks',
    day: 'Day 4',
  },
  async () =>
    expectFields(
      await admin('PATCH', `/admin/students/${studentId}`, { identification_marks: 'x'.repeat(256) }),
      ['identification_marks']
    )
)
await check(
  {
    id: 'API-SU-20',
    module: 'School setup',
    method: 'POST',
    endpoint: '/admin/sections',
    scenario: 'Add a section for next academic year (used by Promote)',
    expected: '201 in the next year; listed only for that year',
    day: 'Day 4',
  },
  async () => {
    const years = (await admin('GET', '/admin/academic-years')).body.data
    const list = Array.isArray(years) ? years : (years.items ?? [])
    const current = list.find((year) => year.is_current)
    const next = list
      .filter((year) => year.start_date > (current?.start_date ?? ''))
      .sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
    if (!next) return 'Skipped: no next academic year'
    const classes = (await admin('GET', '/admin/classes')).body.data
    const target = (Array.isArray(classes) ? classes : classes.items)[0]
    const name = `Z${RUN.slice(-2)}`
    const created = await admin('POST', '/admin/sections', {
      class_id: target.id,
      academic_year_id: next.id,
      name,
    })
    expectStatus(created, 201)
    const inNext = (await admin('GET', `/admin/sections?class_id=${target.id}&academic_year_id=${next.id}`)).body.data
    const inCurrent = (await admin('GET', `/admin/sections?class_id=${target.id}`)).body.data
    await admin('DELETE', `/admin/sections/${created.body.data.id}`)
    if (!inNext.some((item) => item.name === name)) throw new Error('Not listed for next year')
    if (inCurrent.some((item) => item.name === name)) throw new Error('Leaked into the current year')
    return `201 in ${next.name}, not in ${current?.name}`
  }
)

const D4 = (id, module, method, endpoint, scenario, expected, fn) =>
  check({ id, module, method, endpoint, scenario, expected, day: 'Day 4' }, fn)
const istDate = (offset = 0) =>
  new Date(Date.now() + 5.5 * 3600 * 1000 + offset * 86400 * 1000).toISOString().slice(0, 10)
const today = istDate()
const schoolDay = (offset) =>
  new Date(`${istDate(offset)}T00:00:00Z`).getUTCDay() === 0 ? istDate(offset + 1) : istDate(offset)
const month = today.slice(0, 7)
const children = (await parent('GET', '/mobile/parent/children')).body?.data ?? []
const child = children[0]
const teacherClasses = (await teacher('GET', '/mobile/teacher/classes')).body?.data ?? []
const teacherSection = teacherClasses[0]?.section_id
let board = null
let childSectionId = 0

await D4(
  'API-AT-01',
  'Attendance',
  'GET',
  '/admin/attendance/board',
  'Daily board for today',
  '200 with every section and totals',
  async () => {
    const result = await admin('GET', `/admin/attendance/board?date=${today}`)
    expectStatus(result, 200)
    board = result.body.data
    if (!board.sections.length) throw new Error('No sections on the board')
    const name = child ? `${child.class_name} - ${child.section_name}` : ''
    childSectionId = board.sections.find((item) => item.name === name)?.section_id ?? 0
    return `200, ${board.sections_total} sections, ${board.sections_not_marked} not marked`
  }
)
await D4(
  'API-AT-02',
  'Attendance',
  'PUT',
  '/admin/attendance/sections/:id',
  'Save with nothing filled',
  '400 VALIDATION_FAILED on date, items',
  async () => expectFields(await admin('PUT', `/admin/attendance/sections/${childSectionId || 1}`, {}), ['date', 'items'])
)
await D4(
  'API-AT-03',
  'Attendance',
  'PUT',
  '/admin/attendance/sections/:id',
  'Attendance for a future date',
  '400 FUTURE_DATE',
  async () =>
    expectStatus(
      await admin('PUT', `/admin/attendance/sections/${childSectionId || 1}`, {
        date: istDate(3),
        items: [{ student_id: child?.id ?? 1, status: 'present' }],
      }),
      400,
      'FUTURE_DATE'
    )
)
await D4(
  'API-AT-04',
  'Attendance',
  'PUT',
  '/admin/attendance/sections/:id',
  'Mark today with the parent’s child absent',
  '200 saved, child absent, parent gets STUDENT_ABSENT in the app',
  async () => {
    if (!child || !childSectionId) throw new Error('Demo parent has no child on the board')
    if (!board.working_day) return `Skipped: ${today} is not a school day`
    const roster = (await admin('GET', `/admin/attendance/sections/${childSectionId}?date=${today}`)).body.data
    const items = roster.students.map((student) => ({
      student_id: student.student_id,
      status: student.student_id === child.id ? 'absent' : student.on_leave ? 'leave' : 'present',
    }))
    const saved = await admin('PUT', `/admin/attendance/sections/${childSectionId}`, { date: today, items })
    expectStatus(saved, 200)
    const mark = saved.body.data.students.find((student) => student.student_id === child.id)
    if (mark?.status !== 'absent') throw new Error(`Child saved as ${mark?.status}`)
    const inbox = (await parent('GET', '/me/notifications?limit=50')).body?.data?.items ?? []
    const alert = inbox.find(
      (item) => item.template_code === 'STUDENT_ABSENT' && String(item.created_at ?? '').slice(0, 10) === today
    )
    if (!alert) throw new Error('No STUDENT_ABSENT notification for the parent today')
    return `200, absent alert reached the parent: "${alert.title}"`
  }
)
await D4(
  'API-AT-05',
  'Attendance',
  'GET',
  '/mobile/parent/children/:id/attendance',
  'Parent month calendar and today badge',
  '200 with days and %, today absent',
  async () => {
    if (!child) throw new Error('Demo parent has no child')
    const result = await parent('GET', `/mobile/parent/children/${child.id}/attendance?month=${month}`)
    expectStatus(result, 200)
    const todayBadge = (await parent('GET', `/mobile/parent/children/${child.id}/attendance/today`)).body.data
    if (board?.working_day && todayBadge.status !== 'absent') throw new Error(`Today shows ${todayBadge.status}`)
    return `200, ${result.body.data.days?.length ?? 0} days, today ${todayBadge.status}`
  }
)
await D4(
  'API-AT-06',
  'Attendance',
  'GET',
  '/mobile/teacher/sections/:id/attendance',
  'Teacher opens the roster of a section they do not teach',
  '403 or 404, never the roster',
  async () => {
    const other = board?.sections.find((item) => !teacherClasses.some((row) => row.section_id === item.section_id))
    if (!other) return 'Skipped: teacher teaches every section'
    const result = await teacher('GET', `/mobile/teacher/sections/${other.section_id}/attendance?date=${today}`)
    if (![403, 404].includes(result.status)) throw new Error(`Got ${result.status}`)
    return `${result.status} ${result.body?.error}`
  }
)
await D4(
  'API-AT-07',
  'Attendance',
  'GET',
  '/mobile/teacher/sections/:id/attendance',
  'Teacher opens their own section',
  '200 roster in roll order',
  async () => {
    if (!teacherSection) throw new Error('Demo teacher has no section')
    const result = await teacher('GET', `/mobile/teacher/sections/${teacherSection}/attendance?date=${today}`)
    expectStatus(result, 200)
    return `200, ${result.body.data.students.length} students`
  }
)
await D4(
  'API-SA-01',
  'Staff attendance',
  'POST',
  '/mobile/teacher/check-in',
  'Check in with no location',
  '400 VALIDATION_FAILED on lat, lng',
  async () => expectFields(await teacher('POST', '/mobile/teacher/check-in', {}), ['lat', 'lng'])
)
await D4(
  'API-SA-02',
  'Staff attendance',
  'POST',
  '/mobile/teacher/check-in',
  'Check in far from school (Bengaluru)',
  '400 OUTSIDE_SCHOOL',
  async () => {
    const result = await teacher('POST', '/mobile/teacher/check-in', { lat: 12.9716, lng: 77.5946, accuracy_m: 10 })
    if (result.body?.error === 'ALREADY_CHECKED_IN') return '409 ALREADY_CHECKED_IN (checked in earlier today)'
    return expectStatus(result, 400, 'OUTSIDE_SCHOOL')
  }
)
await D4(
  'API-SA-03',
  'Staff attendance',
  'GET',
  '/admin/staff-attendance/board',
  'Staff board for today',
  '200 with present, late, on leave and not checked in',
  async () => {
    const result = await admin('GET', `/admin/staff-attendance/board?date=${today}`)
    expectStatus(result, 200)
    const data = result.body.data
    if (!data.staff.length) throw new Error('No staff on the board')
    return `200, ${data.total} staff: ${data.present} present, ${data.late} late, ${data.on_leave} on leave, ${data.not_checked_in} not in`
  }
)
await D4(
  'API-SA-04',
  'Staff attendance',
  'POST',
  '/integrations/biometric/punches',
  'Biometric punch without the device key',
  '401 DEVICE_KEY_INVALID, or 503 BIOMETRIC_OFF when no key is set',
  async () => {
    const result = await guest('POST', '/integrations/biometric/punches', {
      school_code: 'TZMS',
      punches: [{ employee_no: 'TZMS-EMP-0004', punched_at: `${today}T08:30:00+05:30` }],
    })
    if (![401, 503].includes(result.status)) throw new Error(`Got ${result.status}`)
    return `${result.status} ${result.body?.error}`
  }
)
let leaveTypeId = 0
await D4(
  'API-LV-01',
  'Staff leave',
  'GET',
  '/mobile/teacher/leave-balances',
  'Teacher leave balances',
  '200 with CL, SL, EL, LOP',
  async () => {
    const result = await teacher('GET', '/mobile/teacher/leave-balances')
    expectStatus(result, 200)
    const casual = result.body.data.find((item) => (item.leave_type?.code ?? item.code) === 'CL')
    leaveTypeId = casual?.leave_type?.id ?? casual?.leave_type_id ?? casual?.id ?? 0
    return `200, ${result.body.data.length} leave types`
  }
)
await D4(
  'API-LV-02',
  'Staff leave',
  'POST',
  '/mobile/teacher/leaves',
  'Apply with nothing filled',
  '400 VALIDATION_FAILED on leave_type_id, from_date, to_date, reason',
  async () =>
    expectFields(await teacher('POST', '/mobile/teacher/leaves', {}), ['leave_type_id', 'from_date', 'to_date', 'reason'])
)
await D4(
  'API-LV-03',
  'Staff leave',
  'POST',
  '/mobile/teacher/leaves',
  'Apply for one day of casual leave, then cancel it',
  '201 waiting for approval, then 200 cancelled',
  async () => {
    const date = schoolDay(20)
    const applied = await teacher('POST', '/mobile/teacher/leaves', {
      leave_type_id: leaveTypeId,
      from_date: date,
      to_date: date,
      reason: 'Regression test leave',
    })
    expectStatus(applied, 201)
    const cancelled = await teacher('POST', `/mobile/teacher/leaves/${applied.body.data.id}/cancel`)
    expectStatus(cancelled, 200)
    return `201 ${applied.body.data.status}, then ${cancelled.body.data.status}`
  }
)
await D4(
  'API-LV-04',
  'Student leave',
  'POST',
  '/mobile/parent/children/:id/leaves',
  'Parent applies with the last day before the first',
  '400 VALIDATION_FAILED on to_date',
  async () =>
    expectFields(
      await parent('POST', `/mobile/parent/children/${child?.id ?? 1}/leaves`, {
        from_date: istDate(10),
        to_date: istDate(9),
        reason: 'Regression test',
      }),
      ['to_date']
    )
)
await D4(
  'API-LV-05',
  'Student leave',
  'POST',
  '/mobile/parent/children/:id/leaves',
  'Parent applies for leave, then cancels',
  '201 pending, then 200 cancelled',
  async () => {
    const applied = await parent('POST', `/mobile/parent/children/${child.id}/leaves`, {
      from_date: schoolDay(25),
      to_date: schoolDay(25),
      reason: 'Regression test leave',
    })
    expectStatus(applied, 201)
    const cancelled = await parent('POST', `/mobile/parent/children/${child.id}/leaves/${applied.body.data.id}/cancel`)
    expectStatus(cancelled, 200)
    return `201 ${applied.body.data.status}, then ${cancelled.body.data.status}`
  }
)
let grid = null
await D4(
  'API-TT-01',
  'Timetable',
  'GET',
  '/admin/timetable/periods',
  'Bell schedule',
  '200 with 8 teaching periods and 2 breaks',
  async () => {
    const result = await admin('GET', '/admin/timetable/periods')
    expectStatus(result, 200)
    const teaching = result.body.data.filter((item) => !item.is_break).length
    return `200, ${teaching} periods, ${result.body.data.length - teaching} breaks`
  }
)
await D4(
  'API-TT-02',
  'Timetable',
  'PUT',
  '/admin/timetable/periods',
  'Bell schedule with overlapping periods',
  '400 BELL_INVALID',
  async () =>
    expectStatus(
      await admin('PUT', '/admin/timetable/periods', {
        items: [
          { name: 'Period 1', start_time: '09:00', end_time: '09:45' },
          { name: 'Period 2', start_time: '09:30', end_time: '10:15' },
        ],
      }),
      400,
      'BELL_INVALID'
    )
)
await D4(
  'API-TT-03',
  'Timetable',
  'GET',
  '/admin/timetable/sections/:id',
  'Section timetable of 6 - A',
  '200 with slots and subject plan',
  async () => {
    const six = board?.sections.find((item) => item.name === '6 - A')
    if (!six) throw new Error('6 - A not on the board')
    const result = await admin('GET', `/admin/timetable/sections/${six.section_id}`)
    expectStatus(result, 200)
    grid = result.body.data
    return `200, ${grid.slots.length} periods placed, ${grid.plan.length} subjects`
  }
)
await D4(
  'API-TT-04',
  'Timetable',
  'PUT',
  '/admin/timetable/sections/:id/slots',
  'Same teacher in another section in the same period',
  '409 TEACHER_CLASH',
  async () => {
    const busy = grid?.slots.find((slot) => slot.teacher)
    const other = board?.sections.find((item) => item.section_id !== grid?.section.id)
    if (!busy || !other) throw new Error('No seeded slot to clash with')
    return expectStatus(
      await admin('PUT', `/admin/timetable/sections/${other.section_id}/slots`, {
        day_of_week: busy.day_of_week,
        period_no: busy.period_no,
        subject_id: busy.subject.id,
        teacher_user_id: busy.teacher.id,
        room: null,
      }),
      409,
      'TEACHER_CLASH'
    )
  }
)
await D4(
  'API-TT-05',
  'Timetable',
  'PUT',
  '/admin/timetable/sections/:id/slots',
  'Put a subject with no day or period',
  '400 VALIDATION_FAILED on day_of_week, period_no, subject_id',
  async () =>
    expectFields(await admin('PUT', `/admin/timetable/sections/${grid?.section.id ?? 1}/slots`, {}), [
      'day_of_week',
      'period_no',
      'subject_id',
    ])
)
await D4(
  'API-TT-06',
  'Timetable',
  'GET',
  '/admin/timetable/workload',
  'Teacher workload report',
  '200 with periods per teacher',
  async () => {
    const result = await admin('GET', '/admin/timetable/workload')
    expectStatus(result, 200)
    return `200, ${result.body.data.teachers.length} teachers, ${result.body.data.unscheduled} periods still to place`
  }
)
await D4(
  'API-TT-07',
  'Timetable',
  'GET',
  '/mobile/teacher/timetable',
  'Teacher’s own week in the Staff app',
  '200 with my periods',
  async () => {
    const result = await teacher('GET', '/mobile/teacher/timetable')
    expectStatus(result, 200)
    return `200, ${result.body.data.periods_per_week} periods a week`
  }
)

const D5 = (id, module, method, endpoint, scenario, expected, fn) =>
  check({ id, module, method, endpoint, scenario, expected, day: 'Day 5' }, fn)
const nextSchoolDay = (() => {
  let offset = 1
  while (new Date(`${istDate(offset)}T00:00:00Z`).getUTCDay() === 0) offset += 1
  return istDate(offset)
})()
const teacherMe = (await teacher('GET', '/me')).body?.data
let coverPeriod = null
let substitutionId = 0

await D5(
  'API-SB-01',
  'Substitutes',
  'GET',
  '/admin/substitutes',
  `Board for ${nextSchoolDay}, when a teacher is on approved leave`,
  '200 with the absent teacher and the periods to cover',
  async () => {
    const result = await admin('GET', `/admin/substitutes?date=${nextSchoolDay}`)
    expectStatus(result, 200)
    const board = result.body.data
    if (!board.absent_teachers) return `Skipped: nobody is away on ${nextSchoolDay}`
    for (const away of board.teachers) {
      for (const period of away.periods) {
        const free = (await admin('GET', `/admin/substitutes/free?date=${nextSchoolDay}&slot_id=${period.slot_id}`))
          .body.data
        if (free.teachers.some((row) => row.teacher.id === teacherMe?.id) && !period.substitute) {
          coverPeriod = period
          break
        }
      }
      if (coverPeriod) break
    }
    return `200, ${board.absent_teachers} away, ${board.periods} periods, ${board.uncovered} not covered`
  }
)
await D5(
  'API-SB-02',
  'Substitutes',
  'POST',
  '/admin/substitutes',
  'Assign with nothing filled',
  '400 VALIDATION_FAILED on date, slot_id, substitute_user_id',
  async () => expectFields(await ao('POST', '/admin/substitutes', {}), ['date', 'slot_id', 'substitute_user_id'])
)
await D5(
  'API-SB-03',
  'Substitutes',
  'POST',
  '/admin/substitutes',
  'Assign for a date in the past',
  '400 VALIDATION_FAILED on date',
  async () =>
    expectFields(
      await ao('POST', '/admin/substitutes', { date: istDate(-7), slot_id: 1, substitute_user_id: 1 }),
      ['date']
    )
)
await D5(
  'API-SB-04',
  'Substitutes',
  'POST',
  '/admin/substitutes',
  'Assign a free teacher and check they are told',
  '201, period covered, teacher gets SUBSTITUTE_ASSIGNED',
  async () => {
    if (!coverPeriod) return 'Skipped: no period where the demo teacher is free'
    const result = await ao('POST', '/admin/substitutes', {
      date: nextSchoolDay,
      slot_id: coverPeriod.slot_id,
      substitute_user_id: teacherMe.id,
      note: 'Regression test',
    })
    expectStatus(result, 201)
    const period = result.body.data.teachers.flatMap((row) => row.periods).find((row) => row.slot_id === coverPeriod.slot_id)
    if (period?.substitute?.id !== teacherMe.id) throw new Error('Period not covered')
    substitutionId = period.substitution_id
    const inbox = (await teacher('GET', '/me/notifications?limit=20')).body?.data?.items ?? []
    const alert = inbox.find((item) => item.template_code === 'SUBSTITUTE_ASSIGNED')
    if (!alert) throw new Error('Teacher has no SUBSTITUTE_ASSIGNED notification')
    return `201, covered by ${teacherMe.name}; notified: "${alert.title}"`
  }
)
await D5(
  'API-SB-05',
  'Substitutes',
  'GET',
  '/mobile/teacher/substitutions',
  'Teacher sees the class they cover',
  '200 listing the substitution',
  async () => {
    if (!substitutionId) return 'Skipped: nothing assigned'
    const result = await teacher('GET', '/mobile/teacher/substitutions')
    expectStatus(result, 200)
    if (!result.body.data.some((row) => row.id === substitutionId)) throw new Error('Not listed')
    return `200, ${result.body.data.length} cover duties`
  }
)
await D5(
  'API-SB-06',
  'Substitutes',
  'DELETE',
  '/admin/substitutes/:id',
  'Remove the substitute again',
  '200 and the period is uncovered',
  async () => {
    if (!substitutionId) return 'Skipped: nothing assigned'
    const result = await ao('DELETE', `/admin/substitutes/${substitutionId}`)
    expectStatus(result, 200)
    const period = result.body.data.teachers.flatMap((row) => row.periods).find((row) => row.slot_id === coverPeriod.slot_id)
    if (period?.substitute) throw new Error('Still covered')
    return '200, period uncovered'
  }
)

let draftRunId = 0
await D5(
  'API-PY-01',
  'Payroll',
  'PUT',
  '/admin/payroll/salaries/:userId',
  'Save a salary with no basic pay',
  '400 VALIDATION_FAILED on effective_from, basic',
  async () => expectFields(await admin('PUT', `/admin/payroll/salaries/${teacherMe?.id ?? 1}`, {}), ['effective_from', 'basic'])
)
await D5(
  'API-PY-02',
  'Payroll',
  'POST',
  '/admin/payroll/runs',
  'Run payroll for a future month',
  '400 VALIDATION_FAILED on month',
  async () => {
    const future = new Date(Date.now() + 70 * 86400000).toISOString().slice(0, 7)
    return expectFields(await admin('POST', '/admin/payroll/runs', { month: future }), ['month'])
  }
)
await D5(
  'API-PY-03',
  'Payroll',
  'POST',
  '/admin/payroll/runs',
  'Run payroll for October 2026 as a draft',
  '200 with payslips, totals and the staff left out',
  async () => {
    const result = await admin('POST', '/admin/payroll/runs', { month: '2026-10' })
    if (result.body?.error === 'RUN_FINALIZED') return '409 RUN_FINALIZED (October already final)'
    expectStatus(result, 200)
    const run = result.body.data
    draftRunId = run.id
    if (!run.payslips.length) throw new Error('No payslips')
    const bad = run.payslips.find((slip) => Math.abs(slip.gross - slip.total_deductions - slip.net) > 0.01)
    if (bad) throw new Error(`Net does not add up for ${bad.name}`)
    return `200, ${run.payslips.length} payslips, net ₹${run.total_net}, ${run.missing.length} without salary`
  }
)
await D5(
  'API-PY-04',
  'Payroll',
  'GET',
  '/admin/payroll/payslips/:id/pdf',
  'Payslip PDF',
  '200 application/pdf',
  async () => {
    if (!draftRunId) return 'Skipped: no draft run'
    const run = (await admin('GET', `/admin/payroll/runs/${draftRunId}`)).body.data
    const response = await fetch(`${API}/admin/payroll/payslips/${run.payslips[0].id}/pdf`, {
      headers: { authorization: `Bearer ${adminToken}` },
    })
    const bytes = Buffer.from(await response.arrayBuffer())
    if (response.status !== 200 || !bytes.subarray(0, 4).equals(Buffer.from('%PDF')))
      throw new Error(`Got ${response.status} ${response.headers.get('content-type')}`)
    return `200 PDF, ${Math.round(bytes.length / 1024)} KB`
  }
)
await D5(
  'API-PY-05',
  'Payroll',
  'POST',
  '/admin/payroll/runs/:id/finalize',
  'Finalise September 2026 and the teacher downloads the payslip in the app',
  '200 final; teacher sees it in /me/payslips and gets the PDF',
  async () => {
    let run = (await admin('GET', '/admin/payroll/runs?search=2026-09')).body.data.items[0]
    if (!run || run.status !== 'finalized') {
      const created = await admin('POST', '/admin/payroll/runs', { month: '2026-09' })
      expectStatus(created, 200)
      expectStatus(await admin('POST', `/admin/payroll/runs/${created.body.data.id}/finalize`), 200)
    }
    const mine = await teacher('GET', '/me/payslips')
    expectStatus(mine, 200)
    const slip = mine.body.data.items.find((item) => item.month === '2026-09')
    if (!slip) throw new Error('Teacher has no September payslip')
    const response = await fetch(`${API}/me/payslips/${slip.id}/pdf`, {
      headers: { authorization: `Bearer ${teacherToken}` },
    })
    if (response.status !== 200) throw new Error(`PDF ${response.status}`)
    const rerun = await admin('POST', '/admin/payroll/runs', { month: '2026-09' })
    expectStatus(rerun, 409, 'RUN_FINALIZED')
    return `final; teacher net ₹${slip.net}; PDF 200; re-run blocked with RUN_FINALIZED`
  }
)
await D5(
  'API-PY-06',
  'Payroll',
  'DELETE',
  '/admin/payroll/runs/:id',
  'Delete the October draft',
  '200',
  async () => {
    if (!draftRunId) return 'Skipped: no draft run'
    return expectStatus(await admin('DELETE', `/admin/payroll/runs/${draftRunId}`), 200)
  }
)

await D5(
  'API-TR-01',
  'Transport',
  'POST',
  '/admin/transport/vehicles',
  'Add a bus with nothing filled',
  '400 VALIDATION_FAILED on registration_no, name',
  async () => expectFields(await admin('POST', '/admin/transport/vehicles', {}), ['registration_no', 'name'])
)
await D5(
  'API-TR-02',
  'Transport',
  'POST',
  '/admin/transport/vehicles',
  'Registration number in the wrong format',
  '400 VALIDATION_FAILED on registration_no',
  async () =>
    expectFields(await admin('POST', '/admin/transport/vehicles', { registration_no: 'BUS-ONE', name: 'Bus X' }), [
      'registration_no',
    ])
)
await D5(
  'API-TR-03',
  'Transport',
  'GET',
  '/admin/transport/routes/:id',
  'Every route is drawn: stops with coordinates and the school',
  '200, each route has ordered stops and a distance',
  async () => {
    const routes = (await admin('GET', '/admin/transport/routes')).body.data
    if (!routes.length) throw new Error('No routes')
    const drawn = []
    for (const route of routes) {
      const detail = (await admin('GET', `/admin/transport/routes/${route.id}`)).body.data
      if (detail.stop_list.length < 2) throw new Error(`${route.code} has fewer than 2 stops`)
      const ordered = detail.stop_list.every((stop, index) => stop.sequence === index + 1)
      if (!ordered || detail.stop_list.some((stop) => typeof stop.lat !== 'number')) throw new Error(`${route.code} stops are not usable`)
      drawn.push(`${route.code} ${detail.stop_list.length} stops ${detail.distance_km} km`)
    }
    return `200, ${drawn.join('; ')}`
  }
)
await D5(
  'API-TR-04',
  'Transport',
  'PUT',
  '/admin/transport/routes/:id/stops',
  'Stop with a latitude out of range',
  '400 VALIDATION_FAILED on the stop latitude',
  async () => {
    const route = (await admin('GET', '/admin/transport/routes')).body.data[0]
    return expectFields(
      await admin('PUT', `/admin/transport/routes/${route.id}/stops`, { items: [{ name: 'Bad stop', lat: 123, lng: 80 }] }),
      ['items']
    )
  }
)
await D5(
  'API-TR-05',
  'Transport',
  'POST',
  '/admin/transport/routes',
  'Create a route, add two stops, auto order, delete',
  '201, stops saved, ordered, deleted',
  async () => {
    const code = `T${RUN.slice(-3)}`
    const created = await admin('POST', '/admin/transport/routes', { code, name: `Regression ${RUN}` })
    expectStatus(created, 201)
    const id = created.body.data.id
    const saved = await admin('PUT', `/admin/transport/routes/${id}/stops`, {
      items: [
        { name: 'Near stop', lat: 13.0849, lng: 80.2105 },
        { name: 'Far stop', lat: 13.0846, lng: 80.1767 },
      ],
    })
    expectStatus(saved, 200)
    const ordered = await admin('POST', `/admin/transport/routes/${id}/auto-sequence`)
    expectStatus(ordered, 200)
    const first = ordered.body.data.stop_list[0].name
    expectStatus(await admin('DELETE', `/admin/transport/routes/${id}`), 200)
    if (first !== 'Far stop') throw new Error(`Auto order started at ${first}`)
    return '201, 2 stops, auto order starts at the far stop, deleted'
  }
)
await D5(
  'API-TR-06',
  'Transport',
  'GET',
  '/mobile/parent/children/:id/transport',
  'Parent sees the bus, stop and times',
  '200 with route and stop, or null when the child walks',
  async () => {
    if (!child) throw new Error('Demo parent has no child')
    const result = await parent('GET', `/mobile/parent/children/${child.id}/transport`)
    expectStatus(result, 200)
    const card = result.body.data
    return card ? `200, ${card.route.name}, ${card.stop.name} at ${card.stop.pickup_time}` : '200, child walks (null)'
  }
)
await D5(
  'API-TR-07',
  'Transport',
  'GET',
  '/admin/transport/expiries',
  'Documents ending within 30 days',
  '200 with the seeded PUC, insurance and expired fitness',
  async () => {
    const result = await admin('GET', '/admin/transport/expiries?days=30')
    expectStatus(result, 200)
    const kinds = new Set(result.body.data.map((item) => item.kind))
    if (!kinds.size) throw new Error('Nothing due')
    return `200, ${result.body.data.length} due: ${[...kinds].join(', ')}`
  }
)

await D5(
  'API-TR-08',
  'Transport',
  'GET',
  '/admin/transport/students',
  'Students on the bus with the default sort, a search and paging',
  '200 every time (was 500 before the fix)',
  async () => {
    for (const query of ['', '?search=a', '?route_id=1&page=2&limit=5']) {
      expectStatus(await admin('GET', `/admin/transport/students${query}`), 200)
    }
    return '200 for default sort, search and page 2'
  }
)

await check(
  {
    id: 'API-AU-05',
    module: 'Auth',
    method: 'POST',
    endpoint: '/auth/otp/request',
    scenario: 'Super admin asks for an OTP in the mobile app',
    expected: '403 APP_NOT_ALLOWED, no SMS sent',
    day: 'Day 5',
  },
  async () =>
    expectStatus(
      await guest('POST', '/auth/otp/request', { mobile: '9999999999', app: 'mobile' }),
      403,
      'APP_NOT_ALLOWED'
    )
)
await check(
  {
    id: 'API-AU-06',
    module: 'Auth',
    method: 'POST',
    endpoint: '/auth/otp/request',
    scenario: 'Parent asks for an OTP on the admin web',
    expected: '403 APP_NOT_ALLOWED, no SMS sent',
    day: 'Day 5',
  },
  async () =>
    expectStatus(
      await guest('POST', '/auth/otp/request', { mobile: '9000000005', app: 'admin' }),
      403,
      'APP_NOT_ALLOWED'
    )
)
await check(
  {
    id: 'API-AU-07',
    module: 'Auth',
    method: 'GET',
    endpoint: '/me',
    scenario: 'Profile lists the sections for the role switcher',
    expected: '200 with mobile_apps and sections (label and roles)',
    day: 'Day 5',
  },
  async () => {
    const me = (await parent('GET', '/me')).body.data
    if (!me.mobile_apps?.includes('parent')) throw new Error(`mobile_apps is ${JSON.stringify(me.mobile_apps)}`)
    const section = me.sections.find((item) => item.app === 'parent')
    if (!section?.roles.length) throw new Error('No Parent section with roles')
    return `200, mobile_apps ${JSON.stringify(me.mobile_apps)}, sections ${me.sections.map((item) => item.label).join(', ')}`
  }
)

const D6 = (id, module, method, endpoint, scenario, expected, fn) =>
  check({ id, module, method, endpoint, scenario, expected, day: 'Day 6' }, fn)
await D6(
  'API-TP-01',
  'Live trips',
  'POST',
  '/integrations/telematics/events',
  'Trip event without a valid signature',
  '401 SIGNATURE_INVALID',
  async () => expectStatus(await guest('POST', '/integrations/telematics/events', { type: 'trip.started' }), 401, 'SIGNATURE_INVALID')
)
await D6(
  'API-TP-02',
  'Live trips',
  'POST',
  '/admin/transport/trips',
  'Start a trip with nothing filled',
  '400 VALIDATION_FAILED on route_id, kind',
  async () => expectFields(await admin('POST', '/admin/transport/trips', {}), ['route_id', 'kind'])
)
await D6(
  'API-TP-03',
  'Live trips',
  'GET',
  '/admin/transport/trips/:id',
  'Latest trip: stop timeline in travel order and events',
  '200, every stop approached before it was reached',
  async () => {
    const list = await admin('GET', '/admin/transport/trips?limit=1')
    expectStatus(list, 200)
    const latest = list.body.data.items[0]
    if (!latest) return 'Skipped: no trip has run yet'
    const detail = (await admin('GET', `/admin/transport/trips/${latest.id}`)).body.data
    for (const stop of detail.stop_list.filter((item) => item.arrived_at)) {
      if (!stop.approached_at || new Date(stop.approached_at) > new Date(stop.arrived_at))
        throw new Error(`${stop.name}: approaching did not come before arrival`)
    }
    return `200, trip ${latest.id} ${latest.status}, ${detail.stop_list.length} stops, ${detail.events.length} events`
  }
)
await D6(
  'API-TP-04',
  'Live trips',
  'GET',
  '/mobile/parent/children/:id/bus',
  'Parent bus card',
  '200 with status and headline (null when the child walks)',
  async () => {
    const result = await parent('GET', `/mobile/parent/children/${child.id}/bus`)
    expectStatus(result, 200)
    const bus = result.body.data
    return bus ? `200, ${bus.status}: "${bus.headline}"` : '200, child does not use the bus'
  }
)
await D6(
  'API-TP-05',
  'Live trips',
  'GET',
  '/mobile/driver/trips/today',
  'Parent opens the driver screen',
  '403 FORBIDDEN',
  async () => expectStatus(await parent('GET', '/mobile/driver/trips/today'), 403)
)
await D6(
  'API-TP-06',
  'Live trips',
  'WS',
  '/live',
  'Socket without a token',
  'Connection refused with TOKEN_MISSING',
  async () => {
    const { io } = await import('socket.io-client')
    const origin = API.replace(/\/api\/v1$/, '')
    const socket = io(`${origin}/live`, { transports: ['websocket'], reconnection: false, timeout: 5000 })
    const outcome = await new Promise((resolve) => {
      socket.on('connect', () => resolve('connected'))
      socket.on('connect_error', (error) => resolve(error.data?.error ?? error.message))
    })
    socket.close()
    if (outcome !== 'TOKEN_MISSING') throw new Error(`Got ${outcome}`)
    return 'refused: TOKEN_MISSING'
  }
)

const TA = (id, module, method, endpoint, scenario, expected, fn) =>
  check({ id, module, method, endpoint, scenario, expected, day: 'Teacher app' }, fn)
const teacherRoster = teacherSection
  ? ((await teacher('GET', `/mobile/teacher/sections/${teacherSection}/students`)).body?.data ?? [])
  : []
const rosterStudent = teacherRoster[0]
await TA(
  'API-TA-01',
  'Teacher app',
  'GET',
  '/mobile/teacher/timetable/today',
  "Teacher's day with student count per period",
  '200 with periods, kind and students',
  async () => {
    const result = await teacher('GET', '/mobile/teacher/timetable/today')
    expectStatus(result, 200)
    const day = result.body.data
    if (!Array.isArray(day.periods) || !day.periods.length) throw new Error('No periods')
    const lesson = day.periods.find((item) => item.kind === 'class' || item.kind === 'substitute')
    if (lesson && !(lesson.students >= 0)) throw new Error('students count missing')
    return `200, ${day.day_name}, ${day.my_periods} periods${lesson ? `, ${lesson.section.name} has ${lesson.students} students` : ''}`
  }
)
await TA(
  'API-TA-02',
  'Teacher app',
  'GET',
  '/mobile/teacher/timetable/today',
  'Parent opens the teacher timetable',
  '403 FORBIDDEN',
  async () => expectStatus(await parent('GET', '/mobile/teacher/timetable/today'), 403)
)
await TA(
  'API-TA-03',
  'Teacher app',
  'GET',
  '/mobile/teacher/students/:id/history',
  'Full history of a student in my section',
  '200 with attendance, behaviour, achievements, results',
  async () => {
    if (!rosterStudent) return 'Skipped: teacher has no section'
    const result = await teacher('GET', `/mobile/teacher/students/${rosterStudent.id}/history`)
    expectStatus(result, 200)
    const data = result.body.data
    for (const key of ['attendance_year', 'attendance_month', 'behaviour', 'achievements', 'results'])
      if (!(key in data)) throw new Error(`${key} missing`)
    return `200, ${data.student.full_name}: ${data.attendance_year.percent}% attendance, ${data.results.length} results, ${data.achievements.length} achievements`
  }
)
await TA(
  'API-TA-04',
  'Teacher app',
  'GET',
  '/mobile/teacher/students/:id/history',
  'History of a student outside my sections',
  '403 NOT_YOUR_SECTION',
  async () => {
    const others = (await admin('GET', '/admin/students?limit=50')).body.data.items
    const outsider = others.find((item) => !teacherRoster.some((row) => row.id === item.id))
    if (!outsider) return 'Skipped: every student is in my section'
    return expectStatus(
      await teacher('GET', `/mobile/teacher/students/${outsider.id}/history`),
      403,
      'NOT_YOUR_SECTION'
    )
  }
)
await TA(
  'API-TA-05',
  'Achievements',
  'POST',
  '/mobile/teacher/students/:id/achievements',
  'Add an achievement with nothing filled',
  '400 VALIDATION_FAILED on title, category, achieved_on',
  async () => {
    if (!rosterStudent) return 'Skipped: teacher has no section'
    return expectFields(
      await teacher('POST', `/mobile/teacher/students/${rosterStudent.id}/achievements`, {}),
      ['title', 'category', 'achieved_on']
    )
  }
)
await TA(
  'API-TA-06',
  'Achievements',
  'POST',
  '/mobile/teacher/students/:id/achievements',
  'Teacher adds an achievement; admin sees it and deletes it',
  '201, listed for admin, 200 on delete',
  async () => {
    if (!rosterStudent) return 'Skipped: teacher has no section'
    const added = await teacher('POST', `/mobile/teacher/students/${rosterStudent.id}/achievements`, {
      title: `Regression quiz ${RUN}`,
      category: 'competition',
      level: 'district',
      position: '2nd place',
      achieved_on: TODAY_IST,
    })
    expectStatus(added, 201)
    const list = (await admin('GET', `/admin/students/${rosterStudent.id}/achievements`)).body.data
    if (!list.some((item) => item.id === added.body.data.id)) throw new Error('Admin list does not show it')
    expectStatus(
      await admin('DELETE', `/admin/students/${rosterStudent.id}/achievements/${added.body.data.id}`),
      200
    )
    return `201 "${added.body.data.title}", admin sees it, deleted`
  }
)
await TA(
  'API-TA-07',
  'Achievements',
  'GET',
  '/mobile/parent/children/:id/achievements',
  "Parent sees the child's achievements",
  '200 list',
  async () => {
    const result = await parent('GET', `/mobile/parent/children/${child.id}/achievements`)
    expectStatus(result, 200)
    return `200, ${result.body.data.length} achievements`
  }
)
await TA(
  'API-TA-08',
  'Exams',
  'GET',
  '/admin/exams',
  'Exam list',
  '200 paginated',
  async () => {
    const result = await admin('GET', '/admin/exams?limit=5')
    expectStatus(result, 200)
    return `200, ${result.body.data.total} exams`
  }
)
await TA(
  'API-TA-09',
  'Exams',
  'POST',
  '/admin/exams',
  'Create an exam with nothing filled',
  '400 VALIDATION_FAILED',
  async () => expectStatus(await admin('POST', '/admin/exams', {}), 400, 'VALIDATION_FAILED')
)
await TA(
  'API-TA-10',
  'Exams',
  'GET',
  '/admin/exams/:id/toppers',
  'Top rank holders of the latest exam',
  '200',
  async () => {
    const exam = (await admin('GET', '/admin/exams?limit=1')).body.data.items[0]
    if (!exam) return 'Skipped: no exam yet'
    const result = await admin('GET', `/admin/exams/${exam.id}/toppers`)
    expectStatus(result, 200)
    return `200, ${exam.name}`
  }
)
await TA(
  'API-TA-11',
  'Exams',
  'GET',
  '/mobile/teacher/sections/:id/ranking',
  'Teacher sees the section ranking',
  '200',
  async () => {
    if (!teacherSection) return 'Skipped: teacher has no section'
    return expectStatus(await teacher('GET', `/mobile/teacher/sections/${teacherSection}/ranking`), 200)
  }
)
await TA(
  'API-TA-12',
  'Fees',
  'GET',
  '/admin/fees/insights',
  'Fee insight counts',
  '200',
  async () => expectStatus(await admin('GET', '/admin/fees/insights'), 200)
)
await TA(
  'API-TA-13',
  'Fees',
  'POST',
  '/admin/fees/heads',
  'Fee head with nothing filled',
  '400 VALIDATION_FAILED',
  async () => expectStatus(await admin('POST', '/admin/fees/heads', {}), 400, 'VALIDATION_FAILED')
)
await TA(
  'API-TA-14',
  'Fees',
  'GET',
  '/mobile/parent/children/:id/fees',
  "Parent sees the child's fees",
  '200',
  async () => expectStatus(await parent('GET', `/mobile/parent/children/${child.id}/fees`), 200)
)
await TA(
  'API-TA-15',
  'Fees',
  'GET',
  '/mobile/teacher/sections/:id/students',
  'Roster carries the fee key (filled for the class teacher only)',
  '200 with fee on each row',
  async () => {
    if (!rosterStudent) return 'Skipped: teacher has no section'
    if (!('fee' in rosterStudent)) throw new Error('fee key missing')
    return `200, first fee: ${JSON.stringify(rosterStudent.fee).slice(0, 60)}`
  }
)

const AO = (id, module, method, endpoint, scenario, expected, fn) =>
  check({ id, module, method, endpoint, scenario, expected, day: 'AO and logo' }, fn)
await AO(
  'API-AO-01',
  'AO access',
  'GET',
  '/me',
  'AO signs in to the admin web',
  '200, admin app, substitutes.manage, no payroll or users.manage',
  async () => {
    const me = (await ao('GET', '/me')).body.data
    if (!me.apps.includes('admin')) throw new Error(`apps ${me.apps}`)
    if (!me.permissions.includes('substitutes.manage')) throw new Error('No substitutes.manage')
    for (const code of ['payroll.view', 'users.manage', 'staff.bank', 'schools.manage'])
      if (me.permissions.includes(code)) throw new Error(`AO has ${code}`)
    return `200, ${me.permissions.length} permissions`
  }
)
await AO(
  'API-AO-02',
  'AO access',
  'GET',
  '/admin/payroll/runs',
  'AO opens payroll',
  '403 FORBIDDEN',
  async () => expectStatus(await ao('GET', '/admin/payroll/runs'), 403, 'FORBIDDEN')
)
await AO(
  'API-AO-03',
  'AO access',
  'PATCH',
  '/admin/school',
  'AO edits school setup',
  '403 FORBIDDEN',
  async () => expectStatus(await ao('PATCH', '/admin/school', { name: 'x' }), 403, 'FORBIDDEN')
)
await AO(
  'API-AO-04',
  'Substitutes',
  'POST',
  '/admin/substitutes',
  'School admin tries to assign a substitute',
  '403 FORBIDDEN (only the AO assigns)',
  async () =>
    expectStatus(
      await admin('POST', '/admin/substitutes', { date: TODAY_IST, slot_id: 1, substitute_user_id: 1 }),
      403,
      'FORBIDDEN'
    )
)
await AO(
  'API-AO-05',
  'Substitutes',
  'POST',
  '/admin/substitutes',
  'AO assigns with nothing filled',
  '400 VALIDATION_FAILED (allowed, checked)',
  async () => expectStatus(await ao('POST', '/admin/substitutes', {}), 400, 'VALIDATION_FAILED')
)
await AO(
  'API-AO-06',
  'School logo',
  'PATCH',
  '/admin/school',
  'Logo pointing at a file that does not exist',
  '400 VALIDATION_FAILED on logo_file_id',
  async () => expectFields(await admin('PATCH', '/admin/school', { logo_file_id: 999999 }), ['logo_file_id'])
)
await AO(
  'API-AO-07',
  'School logo',
  'GET',
  '/me',
  'Profile carries the school logo link',
  '200 with school.logo_url (null when none)',
  async () => {
    const me = (await admin('GET', '/me')).body.data
    if (!('logo_url' in me.school)) throw new Error('school.logo_url missing')
    return `200, logo_url ${me.school.logo_url ? 'set' : 'null'}`
  }
)

const CB = (id, method, endpoint, scenario, expected, fn) =>
  check({ id, module: 'Combine class', method, endpoint, scenario, expected, day: 'AO and logo' }, fn)
const combineCase = await (async () => {
  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(Date.now() + 5.5 * 3600 * 1000 + offset * 86400000).toISOString().slice(0, 10)
    const board = (await ao('GET', `/admin/substitutes?date=${day}`)).body?.data
    for (const period of (board?.teachers ?? []).flatMap((item) => item.periods)) {
      if (period.substitution_id) continue
      const options = (await ao('GET', `/admin/substitutes/combine-options?date=${day}&slot_id=${period.slot_id}`)).body?.data
      if (options?.targets.length >= 2) return { day, period, options }
    }
  }
  return null
})()
await CB('API-CB-01', 'POST', '/admin/substitutes/combine', 'Combine with nothing filled', '400 VALIDATION_FAILED on date, slot_id, mode', async () =>
  expectFields(await ao('POST', '/admin/substitutes/combine', {}), ['date', 'slot_id', 'mode'])
)
await CB('API-CB-02', 'GET', '/admin/substitutes/combine-options', 'Sections the class can sit with', '200 with boys and girls count and running sections', async () => {
  if (!combineCase) return 'Skipped: no uncovered period with two running sections this week'
  const { options } = combineCase
  if (options.students.total !== options.students.boys + options.students.girls) throw new Error('Counts do not add up')
  if (options.targets.some((item) => item.section.id === combineCase.period.section.id)) throw new Error('Own section listed')
  return `200, ${options.students.total} students, targets ${options.targets.map((item) => item.section.name).join(', ')}`
})
await CB('API-CB-03', 'POST', '/admin/substitutes/combine', 'Boys and girls to the same section', '400 on girls_section_id', async () => {
  if (!combineCase) return 'Skipped: no case'
  const target = combineCase.options.targets[0].section.id
  return expectFields(
    await ao('POST', '/admin/substitutes/combine', { date: combineCase.day, slot_id: combineCase.period.slot_id, mode: 'split', boys_section_id: target, girls_section_id: target }),
    ['girls_section_id']
  )
})
await CB('API-CB-04', 'POST', '/admin/substitutes/combine', 'Section with no class in that period', '409 SECTION_NOT_AVAILABLE', async () => {
  if (!combineCase) return 'Skipped: no case'
  return expectStatus(
    await ao('POST', '/admin/substitutes/combine', { date: combineCase.day, slot_id: combineCase.period.slot_id, mode: 'whole', section_id: 999999 }),
    409,
    'SECTION_NOT_AVAILABLE'
  )
})
await CB('API-CB-05', 'POST', '/admin/substitutes/combine', 'School admin tries to combine', '403 FORBIDDEN', async () => {
  if (!combineCase) return 'Skipped: no case'
  return expectStatus(
    await admin('POST', '/admin/substitutes/combine', { date: combineCase.day, slot_id: combineCase.period.slot_id, mode: 'whole', section_id: combineCase.options.targets[0].section.id }),
    403,
    'FORBIDDEN'
  )
})
await CB('API-CB-06', 'POST', '/admin/substitutes/combine', 'AO splits boys and girls, then removes it', '200 kind combine with two groups, covered; removed', async () => {
  if (!combineCase) return 'Skipped: no case'
  const [boys, girls] = combineCase.options.targets
  const result = await ao('POST', '/admin/substitutes/combine', { date: combineCase.day, slot_id: combineCase.period.slot_id, mode: 'split', boys_section_id: boys.section.id, girls_section_id: girls.section.id })
  expectStatus(result, 200)
  const period = result.body.data.teachers.flatMap((item) => item.periods).find((item) => item.slot_id === combineCase.period.slot_id)
  if (period.kind !== 'combine' || period.combined_into.length !== 2) throw new Error(JSON.stringify(period.combined_into))
  expectStatus(await ao('DELETE', `/admin/substitutes/${period.substitution_id}`), 200)
  return `200, ${period.combined_into.map((item) => `${item.group} ${item.students} -> ${item.section.name}`).join(', ')}; removed`
})

await admin('DELETE', `/admin/students/${studentId}`)
if (userId) await admin('DELETE', `/admin/users/${userId}`)

const passed = results.filter((row) => row.status === 'Pass').length
fs.writeFileSync(
  path.join(OUT, 'api.json'),
  JSON.stringify({ run_at: new Date().toISOString(), api: API, day: DAY, results }, null, 2)
)
console.log(`\n${passed}/${results.length} API checks passed. Results: e2e/results/api.json`)
process.exit(passed === results.length ? 0 : 1)
