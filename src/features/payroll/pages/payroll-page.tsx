import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { ReceiptIndianRupee, Wallet } from 'lucide-react'
import { Page, PageHeader } from '@/components/common/page'
import { PageTabs } from '@/components/common/page-tabs'
import { can, useMe } from '@/features/auth/api'
import { RunsTab } from '../components/runs-tab'
import { SalariesTab } from '../components/salaries-tab'
import type { PayrollSearch, PayrollTab } from '../search'

const route = getRouteApi('/_app/payroll')

export function PayrollPage() {
  const search = route.useSearch()
  const navigate = useNavigate({ from: '/payroll' })
  const canManage = can(useMe().data, 'payroll.manage')

  const setSearch = (patch: Partial<PayrollSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })
  const go = (tab: PayrollTab) =>
    setSearch({ tab, run_id: undefined, page: undefined, search: undefined, salary: undefined })

  return (
    <Page>
      <PageHeader
        eyebrow='Finance'
        title='Payroll'
        description='Monthly salary runs with loss of pay, PF and ESI worked out, payslips for every staff member and each person’s salary structure.'
      />
      <PageTabs
        label='Payroll sections'
        value={search.tab}
        onChange={go}
        tabs={[
          { value: 'runs', label: 'Payroll runs', icon: ReceiptIndianRupee },
          { value: 'salaries', label: 'Salaries', icon: Wallet },
        ]}
      />
      {search.tab === 'runs' && (
        <RunsTab
          runId={search.run_id}
          page={search.page ?? 1}
          canManage={canManage}
          onOpenRun={(run_id) => setSearch({ run_id })}
          onPageChange={(page) => setSearch({ page })}
          onOpenSalaries={() => go('salaries')}
        />
      )}
      {search.tab === 'salaries' && (
        <SalariesTab
          search={search}
          canManage={canManage}
          onSearchChange={(patch) => setSearch({ page: undefined, ...patch })}
        />
      )}
    </Page>
  )
}
