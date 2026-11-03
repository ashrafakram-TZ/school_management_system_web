import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AppModal } from '@/components/common/app-modal'
import { Combobox } from '@/components/common/combobox'
import { FormField } from '@/components/common/form-field'
import { useBusRoutes } from '@/features/transport/api'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import { fleetApi, useTripMutation, type StartTripInput, type TripKind } from '../api'
import { TRIP_KIND_OPTIONS } from '../labels'

const defaultKind = (): TripKind => (new Date().getHours() < 12 ? 'pickup' : 'drop')

export function StartTripModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const routes = useBusRoutes()
  const [routeId, setRouteId] = useState<string>()
  const [kind, setKind] = useState<string | undefined>(defaultKind)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const start = useTripMutation((input: StartTripInput) => fleetApi.startTrip(input))

  const options = (routes.data ?? [])
    .filter((route) => route.vehicle && route.is_active)
    .map((route) => ({
      value: String(route.id),
      label: `${route.code} · ${route.name}`,
      hint: `${route.vehicle!.name} · ${route.vehicle!.registration_no}`,
    }))

  return (
    <AppModal
      open
      onOpenChange={(open) => !open && onClose()}
      title='Start a trip'
      description='The bus tracker follows the route from now on and parents get bus alerts. Drivers normally start trips from the app.'
      formId='start-trip-form'
      submitText='Start trip'
      loading={start.isPending}
    >
      <form
        id='start-trip-form'
        noValidate
        className='grid gap-4'
        onSubmit={async (event) => {
          event.preventDefault()
          const next: Record<string, string> = {}
          if (!routeId) next.route_id = 'Choose a route'
          if (!kind) next.kind = 'Choose morning pickup or evening drop'
          setErrors(next)
          if (Object.keys(next).length) return
          try {
            const trip = await start.mutateAsync({
              route_id: Number(routeId),
              kind: kind as TripKind,
            })
            alerts.success('Trip started')
            onClose()
            void navigate({ to: '/fleet/trips/$tripId', params: { tripId: trip.id } })
          } catch (error) {
            const apiError = toApiError(error)
            const fields = Object.fromEntries(
              apiError.fieldErrors.map((item) => [item.field, item.message])
            )
            setErrors(fields)
            if (!Object.keys(fields).length) alerts.error(apiError.message)
          }
        }}
      >
        <FormField
          id='trip-route'
          label='Route'
          required
          error={errors.route_id}
          hint={
            routes.data && !options.length
              ? 'No route has a bus yet. Give a route a bus in Buses and routes.'
              : 'Only routes that have a bus are listed.'
          }
        >
          <Combobox
            id='trip-route'
            label='Route'
            value={routeId}
            options={options}
            placeholder={routes.isPending ? 'Loading routes' : 'Choose a route'}
            searchPlaceholder='Search routes'
            emptyText='No routes with a bus'
            invalid={Boolean(errors.route_id)}
            className='sm:w-full'
            onChange={setRouteId}
          />
        </FormField>
        <FormField id='trip-kind' label='Trip' required error={errors.kind}>
          <Combobox
            id='trip-kind'
            label='Trip'
            value={kind}
            options={TRIP_KIND_OPTIONS}
            placeholder='Choose a trip'
            searchPlaceholder='Search'
            invalid={Boolean(errors.kind)}
            className='sm:w-full'
            onChange={setKind}
          />
        </FormField>
      </form>
    </AppModal>
  )
}
