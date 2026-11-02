import { useEffect, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, BellRing, Bus, CalendarCheck2, ShieldCheck } from 'lucide-react'
import { BrandLogo, BrandMark } from '@/components/common/brand-logo'
import { FormField } from '@/components/common/form-field'
import { OtpInput } from '@/components/common/otp-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { config } from '@/config/env'
import { toApiError } from '@/lib/api/errors'
import { session } from '@/lib/auth/session'
import { authApi, meKey, type OtpSent } from '../api'

const route = getRouteApi('/login')

const FEATURES = [
  {
    icon: Bus,
    title: 'Live bus tracking',
    text: 'Every bus on one map, with stop alerts to parents.',
  },
  {
    icon: CalendarCheck2,
    title: 'Attendance and diary',
    text: 'Teachers mark, parents know within a minute.',
  },
  {
    icon: BellRing,
    title: 'Alerts in Tamil and English',
    text: 'Push first, SMS when the app is offline.',
  },
]

const normalize = (value: string) => {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits.slice(0, 10)
}

export function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { redirect } = route.useSearch()
  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState('')
  const [sent, setSent] = useState<OtpSent | null>(null)
  const [resendIn, setResendIn] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [resendIn])

  const requestOtp = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError('Enter a valid 10-digit mobile number')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await authApi.requestOtp(mobile)
      setSent(result)
      setOtp('')
      setResendIn(result.resend_in)
    } catch (caught) {
      setError(toApiError(caught).message)
    } finally {
      setBusy(false)
    }
  }

  const verify = async (code = otp) => {
    if (code.length !== 6 || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await authApi.verifyOtp(mobile, code)
      if (!result.user.apps.includes('admin')) {
        session.set({ accessToken: result.access_token, refreshToken: result.refresh_token })
        await authApi.logout().catch(() => null)
        session.clear()
        setError(
          'This number does not have admin access. Use the Tamilzorous School app on your phone.'
        )
        setOtp('')
        return
      }
      session.set({ accessToken: result.access_token, refreshToken: result.refresh_token })
      queryClient.setQueryData(meKey, result.user)
      await navigate({ to: redirect && redirect.startsWith('/') ? redirect : '/', replace: true })
    } catch (caught) {
      setError(toApiError(caught).message)
      setOtp('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className='grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]'>
      <section className='relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col'>
        <div
          aria-hidden
          className='pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:22px_22px] opacity-[0.07]'
        />
        <div
          aria-hidden
          className='pointer-events-none absolute -right-32 -bottom-32 size-[28rem] rounded-full bg-sidebar-primary/15 blur-3xl'
        />
        <BrandLogo className='relative h-8 text-sidebar-accent-foreground' />
        <div className='relative mt-auto grid max-w-md gap-8'>
          <div className='grid gap-3'>
            <p className='text-[11px] font-bold tracking-[0.16em] text-sidebar-primary uppercase'>
              School management
            </p>
            <h1 className='text-4xl leading-tight font-extrabold tracking-tight text-balance text-sidebar-accent-foreground'>
              Students, staff and every school bus, in one place.
            </h1>
          </div>
          <ul className='grid gap-5'>
            {FEATURES.map((feature) => (
              <li key={feature.title} className='flex gap-4'>
                <span className='grid size-10 shrink-0 place-items-center rounded-xl bg-sidebar-accent text-sidebar-primary'>
                  <feature.icon className='size-5' />
                </span>
                <div className='grid gap-0.5'>
                  <span className='font-bold text-sidebar-accent-foreground'>{feature.title}</span>
                  <span className='text-sm text-sidebar-muted'>{feature.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className='relative mt-12 text-xs text-sidebar-muted'>
          © Tamilzorous · {config.appName}
        </p>
      </section>

      <section className='flex items-center justify-center px-4 py-10 sm:px-8'>
        <div className='grid w-full max-w-sm gap-8'>
          <div className='grid gap-6'>
            <BrandMark className='h-10 lg:hidden' />
            <div className='grid gap-1.5'>
              <h2 className='text-2xl font-extrabold tracking-tight'>
                {sent ? 'Enter the code' : 'Sign in to the admin console'}
              </h2>
              <p className='text-sm text-muted-foreground'>
                {sent
                  ? `We sent a 6-digit code to +91 ${sent.mobile_masked}.`
                  : 'Use the mobile number registered with the school office.'}
              </p>
            </div>
          </div>

          {!sent ? (
            <form className='grid gap-5' onSubmit={requestOtp} noValidate>
              <FormField id='mobile' label='Mobile number' error={error ?? undefined}>
                <div className='flex'>
                  <span className='inline-flex h-11 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm font-semibold text-muted-foreground'>
                    +91
                  </span>
                  <Input
                    id='mobile'
                    type='tel'
                    inputMode='numeric'
                    autoComplete='tel-national'
                    autoFocus
                    placeholder='98765 43210'
                    value={mobile}
                    aria-invalid={Boolean(error) || undefined}
                    onChange={(event) => {
                      setMobile(normalize(event.target.value))
                      setError(null)
                    }}
                    className='tabular h-11 rounded-l-none text-base tracking-wide'
                  />
                </div>
              </FormField>
              <Button
                type='submit'
                size='lg'
                className='h-11'
                loading={busy}
                disabled={mobile.length !== 10}
              >
                Send code
              </Button>
            </form>
          ) : (
            <form
              className='grid gap-5'
              onSubmit={(event) => {
                event.preventDefault()
                void verify()
              }}
              noValidate
            >
              <div className='grid gap-2'>
                <OtpInput
                  value={otp}
                  onChange={(value) => {
                    setOtp(value)
                    setError(null)
                  }}
                  onComplete={(value) => void verify(value)}
                  disabled={busy}
                  invalid={Boolean(error)}
                  autoFocus
                />
                {error && (
                  <p role='alert' className='text-xs font-medium text-destructive'>
                    {error}
                  </p>
                )}
                {import.meta.env.DEV && (
                  <p className='text-xs text-muted-foreground'>
                    Development server: the code is 123456.
                  </p>
                )}
              </div>
              <Button
                type='submit'
                size='lg'
                className='h-11'
                loading={busy}
                disabled={otp.length !== 6}
              >
                Verify and sign in
              </Button>
              <div className='flex items-center justify-between text-sm'>
                <Button
                  type='button'
                  variant='link'
                  className='h-auto px-0'
                  onClick={() => {
                    setSent(null)
                    setOtp('')
                    setError(null)
                  }}
                >
                  <ArrowLeft />
                  Change number
                </Button>
                {resendIn > 0 ? (
                  <span className='tabular text-muted-foreground'>
                    Resend in 0:{String(resendIn).padStart(2, '0')}
                  </span>
                ) : (
                  <Button
                    type='button'
                    variant='link'
                    className='h-auto px-0'
                    onClick={() => void requestOtp()}
                    disabled={busy}
                  >
                    Resend code
                  </Button>
                )}
              </div>
            </form>
          )}

          <p className='flex items-center gap-2 text-xs text-muted-foreground'>
            <ShieldCheck className='size-4 text-primary' />
            Codes expire after 10 minutes. Never share your code with anyone.
          </p>
        </div>
      </section>
    </main>
  )
}
