import { useState } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { Fuel, Plus, Wrench } from 'lucide-react'
import { PageTabs } from '@/components/common/page-tabs'
import { Page, PageHeader } from '@/components/common/page'
import { useShortcut } from '@/components/shortcuts/shortcut-context'
import { Kbd } from '@/components/shortcuts/kbd'
import { Button } from '@/components/ui/button'
import { can, useMe } from '@/features/auth/api'
import { FuelTab } from '../components/fuel-tab'
import { TicketsTab } from '../components/tickets-tab'
import type { MaintenanceSearch, MaintenanceTab } from '../search'

const route = getRouteApi('/_app/fleet/maintenance')

export function MaintenancePage() {
  const search = route.useSearch()
  const navigate = useNavigate({ from: '/fleet/maintenance' })
  const canManage = can(useMe().data, 'fleet.manage')
  const [adding, setAdding] = useState(false)

  const setSearch = (patch: Partial<MaintenanceSearch>) =>
    navigate({ search: (prev) => ({ ...prev, page: 1, ...patch }), replace: true })
  const onPageChange = (page: number) => navigate({ search: (prev) => ({ ...prev, page }) })
  const onClear = () => navigate({ search: { tab: search.tab, page: 1 }, replace: true })
  const changeTab = (tab: MaintenanceTab) =>
    navigate({ search: { tab, page: 1, vehicle_id: search.vehicle_id }, replace: true })

  useShortcut('maintenance.create', () => setAdding(true), { enabled: canManage })

  const tabProps = {
    search,
    setSearch,
    onPageChange,
    onClear,
    canManage,
    adding,
    onAddingChange: setAdding,
  }

  return (
    <Page>
      <PageHeader
        eyebrow='Fleet'
        title='Maintenance'
        description='Repair tickets raised from engine fault codes or by hand, and the fuel log with mileage between fills.'
        actions={
          canManage && (
            <Button onClick={() => setAdding(true)}>
              <Plus />
              {search.tab === 'fuel' ? 'Add fuel entry' : 'Add ticket'}
              <Kbd id='maintenance.create' inverted />
            </Button>
          )
        }
      />
      <PageTabs
        label='Maintenance sections'
        value={search.tab}
        onChange={changeTab}
        tabs={[
          { value: 'tickets', label: 'Tickets', icon: Wrench },
          { value: 'fuel', label: 'Fuel log', icon: Fuel },
        ]}
      />
      {search.tab === 'fuel' ? <FuelTab {...tabProps} /> : <TicketsTab {...tabProps} />}
    </Page>
  )
}
