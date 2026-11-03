import { useState } from 'react'
import { AppModal } from '@/components/common/app-modal'
import { Combobox } from '@/components/common/combobox'
import { FormField } from '@/components/common/form-field'
import { Input } from '@/components/ui/input'
import { alerts } from '@/lib/alerts'
import {
  transportApi,
  useBusRoutes,
  useRouteDetail,
  useTransportMutation,
  type Rider,
  type RiderInput,
  type TransportMode,
} from '../api'
import { MODE_OPTIONS, formErrors } from '../labels'

export function RiderModal({ rider, onClose }: { rider: Rider; onClose: () => void }) {
  const routes = useBusRoutes()
  const [routeId, setRouteId] = useState<string | undefined>(String(rider.route.id))
  const [stopId, setStopId] = useState<string | undefined>(String(rider.stop.id))
  const [mode, setMode] = useState<TransportMode>(rider.mode)
  const [startDate, setStartDate] = useState(rider.start_date)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const detail = useRouteDetail(routeId ? Number(routeId) : undefined)
  const save = useTransportMutation((input: RiderInput) =>
    transportApi.setRider(rider.student.id, input)
  )

  const stopOptions = (detail.data?.stop_list ?? []).map((stop) => ({
    value: String(stop.id),
    label: `${stop.sequence}. ${stop.name}`,
    hint: stop.pickup_time ?? undefined,
  }))

  return (
    <AppModal
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Change stop for ${rider.student.full_name}`}
      formId='rider-form'
      loading={save.isPending}
    >
      <form
        id='rider-form'
        noValidate
        className='grid gap-4 sm:grid-cols-2'
        onSubmit={async (event) => {
          event.preventDefault()
          const next: Record<string, string> = {}
          if (!routeId) next.route_id = 'Choose the route'
          if (!stopId) next.stop_id = 'Choose the stop'
          setErrors(next)
          if (Object.keys(next).length) return
          try {
            await save.mutateAsync({
              route_id: Number(routeId),
              stop_id: Number(stopId),
              mode,
              start_date: startDate || undefined,
            })
            alerts.success('Bus stop saved')
            onClose()
          } catch (error) {
            setErrors(formErrors(error, { BUS_FULL: 'route_id' }))
          }
        }}
      >
        <FormField id='rider-route' label='Route' required error={errors.route_id}>
          <Combobox
            id='rider-route'
            label='Route'
            value={routeId}
            options={(routes.data ?? []).map((route) => ({
              value: String(route.id),
              label: `${route.code} · ${route.name}`,
            }))}
            placeholder='Choose the route'
            searchPlaceholder='Search routes'
            invalid={Boolean(errors.route_id)}
            highlightSelected={false}
            className='sm:w-full'
            onChange={(value) => {
              setRouteId(value)
              setStopId(undefined)
            }}
          />
        </FormField>
        <FormField id='rider-stop' label='Stop' required error={errors.stop_id}>
          <Combobox
            id='rider-stop'
            label='Stop'
            value={stopId}
            options={stopOptions}
            placeholder={routeId ? 'Choose the stop' : 'Choose a route first'}
            searchPlaceholder='Search stops'
            emptyText={routeId ? 'This route has no stops yet' : 'Choose a route first'}
            invalid={Boolean(errors.stop_id)}
            highlightSelected={false}
            className='sm:w-full'
            onChange={setStopId}
          />
        </FormField>
        <FormField id='rider-mode' label='Uses the bus for'>
          <Combobox
            id='rider-mode'
            label='Uses the bus for'
            value={mode}
            options={MODE_OPTIONS}
            placeholder='Choose'
            highlightSelected={false}
            className='sm:w-full'
            onChange={(value) => setMode((value ?? 'both') as TransportMode)}
          />
        </FormField>
        <FormField id='rider-start' label='From date' error={errors.start_date}>
          <Input
            id='rider-start'
            type='date'
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </FormField>
      </form>
    </AppModal>
  )
}
