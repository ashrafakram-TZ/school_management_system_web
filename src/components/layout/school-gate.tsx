import { useEffect, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { can, type Me } from '@/features/auth/api'
import { useSchoolOptions } from '@/features/schools/api'
import { schoolContext, useSelectedSchool } from '@/lib/auth/school-context'

export function SchoolGate({ me, children }: { me: Me; children: ReactNode }) {
  const queryClient = useQueryClient()
  const platform = can(me, 'platform.schools')
  const selected = useSelectedSchool()
  const schools = useSchoolOptions(platform)
  const loaded = schools.data?.items
  const chosen = Boolean(selected && loaded?.some((school) => school.id === selected))

  useEffect(() => {
    if (!platform || !loaded?.length || chosen) return
    schoolContext.set(loaded[0].id)
    void queryClient.invalidateQueries()
  }, [platform, loaded, chosen, queryClient])

  const ready = !platform || chosen || schools.isError || (loaded !== undefined && !loaded.length)
  if (!ready) {
    return (
      <main className='grid gap-4 p-4 sm:p-6' aria-busy='true' aria-label='Opening your school'>
        <Skeleton className='h-10 w-64' />
        <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className='h-24' />
          ))}
        </div>
        <Skeleton className='h-80' />
      </main>
    )
  }
  return children
}
