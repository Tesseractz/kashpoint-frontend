import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import { AdminAPI } from '../../api/client'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Skeleton } from '../../components/ui/Skeleton'
import { PageError, Details } from './bits'
import { fmtDateTime, actionLabel } from './format'

export default function AdminLog() {
  const [params] = useSearchParams()
  const storeId = params.get('store') || ''
  const q = useQuery({
    queryKey: ['admin', 'actions', storeId],
    queryFn: () => AdminAPI.actions({ limit: 200, store_id: storeId }),
  })

  if (q.isError) return <PageError error={q.error} onRetry={() => q.refetch()} />
  if (!q.data) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
      </div>
    )
  }

  const items = q.data.items || []
  if (!items.length) {
    return (
      <Card>
        <EmptyState icon={ScrollText} title="Nothing logged yet" description="Every trial extension, complimentary period, suspension and partner change made here is recorded." compact />
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-900/60 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <tr>
            <th scope="col" className="px-5 py-3">When</th>
            <th scope="col" className="px-4 py-3">What</th>
            <th scope="col" className="px-4 py-3">Store / partner</th>
            <th scope="col" className="px-4 py-3">By</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((a) => (
            <tr key={a.id}>
              <td className="px-5 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">{fmtDateTime(a.created_at)}</td>
              <td className="px-4 py-3">
                <p className="text-slate-900 dark:text-white">{actionLabel(a.action)}</p>
                <Details details={a.details} />
              </td>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                {a.store_id ? (
                  <Link to={`/admin/stores/${a.store_id}`} className="text-brand-600 dark:text-brand-400 hover:underline">
                    {a.store_name || a.store_id}
                  </Link>
                ) : a.partner_name ? (
                  <span>{a.partner_name}</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-300 truncate max-w-[14rem]">{a.actor_email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
