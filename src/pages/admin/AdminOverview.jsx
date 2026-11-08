import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Store, CreditCard, Sparkles, ShoppingBag, Clock, AlertCircle, ArrowRight } from 'lucide-react'
import { AdminAPI } from '../../api/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, StatCard } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Skeleton } from '../../components/ui/Skeleton'
import { StateBadge, PageError, Notice } from './bits'
import { fmtR, fmtInt, ago, subscriptionLine } from './format'

const fmtWeek = (iso) => {
  const d = new Date(`${iso}T12:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function SignupsChart({ weeks }) {
  const max = Math.max(1, ...weeks.map((w) => w.count))
  const summary = weeks.map((w) => `week of ${fmtWeek(w.week_start)}: ${w.count}`).join(', ')
  return (
    <div>
      <div className="flex items-end gap-2 h-32" role="img" aria-label={`Sign-ups per week. ${summary}`}>
        {weeks.map((w) => (
          <div key={w.week_start} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1">
            <span className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">{w.count}</span>
            <div
              className="w-full rounded-t-md bg-brand-600 dark:bg-brand-500"
              style={{ height: `${Math.max(4, Math.round((w.count / max) * 96))}px` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2" aria-hidden>
        {weeks.map((w) => (
          <div key={w.week_start} className="flex-1 min-w-0 text-center text-[10px] text-slate-400 dark:text-slate-500 truncate">
            {fmtWeek(w.week_start)}
          </div>
        ))}
      </div>
    </div>
  )
}

function StoreRow({ item, right }) {
  return (
    <li>
      <Link
        to={`/admin/stores/${item.id}`}
        className="flex items-center gap-3 px-5 sm:px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.owner_email || item.phone || '—'}</p>
        </div>
        <div className="text-right flex-shrink-0">{right}</div>
        <ArrowRight size={16} className="text-slate-400 flex-shrink-0" aria-hidden />
      </Link>
    </li>
  )
}

export default function AdminOverview() {
  const q = useQuery({ queryKey: ['admin', 'overview'], queryFn: AdminAPI.overview, staleTime: 30_000 })

  if (q.isError) return <PageError error={q.error} onRetry={() => q.refetch()} />
  if (!q.data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    )
  }

  const d = q.data
  const states = d.states || {}
  const onTrial = (states.trial || 0) + (states.trial_ending || 0)
  const lapsed = (states.trial_ended || 0) + (states.expired || 0) + (states.canceled || 0)

  return (
    <div className="space-y-5">
      {d.auth_unavailable && (
        <Notice tone="warning">Supabase Auth did not answer, so owner emails and last sign-ins are missing on this load.</Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Stores" value={fmtInt(d.stores_total)} icon={Store} trend={d.stores_new_7d ? `${d.stores_new_7d} new this week` : `${d.stores_new_30d} new in 30 days`} trendUp />
        <StatCard title="Paying" value={fmtInt(d.paying)} icon={CreditCard} accent="accent" trend={`${fmtR(d.mrr_zar)} / month`} trendUp />
        <StatCard title="On trial" value={fmtInt(onTrial)} icon={Sparkles} accent="warm" trend={states.trial_ending ? `${states.trial_ending} ending this week` : undefined} trendUp={false} />
        <StatCard title="Sales, 30 days" value={fmtR(d.sales_30d_total)} icon={ShoppingBag} accent="neutral" trend={`${fmtInt(d.sales_30d_count)} sales across all stores`} trendUp />
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['Lapsed', lapsed, 'neutral'],
          ['Payment failed', states.past_due || 0, 'danger'],
          ['Complimentary', states.comped || 0, 'info'],
          ['Suspended', states.suspended || 0, 'danger'],
          ['No subscription row', states.none || 0, 'neutral'],
        ]
          .filter(([, n]) => n > 0)
          .map(([label, n, tone]) => (
            <Badge key={label} tone={tone} dot>
              {label}: {n}
            </Badge>
          ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Sign-ups</CardTitle>
            <CardDescription>New stores per week, last 8 weeks.</CardDescription>
          </CardHeader>
          <CardContent>
            <SignupsChart weeks={d.signups_by_week || []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock size={18} className="text-amber-600 dark:text-amber-400" aria-hidden /> Trials ending this week
            </CardTitle>
            <CardDescription>A call before the trial ends is when a store decides.</CardDescription>
          </CardHeader>
          {d.trials_ending?.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {d.trials_ending.map((i) => (
                <StoreRow
                  key={i.id}
                  item={i}
                  right={
                    <>
                      <StateBadge sub={i.subscription} size="sm" />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subscriptionLine(i.subscription)}</p>
                    </>
                  }
                />
              ))}
            </ul>
          ) : (
            <CardContent className="text-sm text-slate-500 dark:text-slate-400">No trials end in the next 7 days.</CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle size={18} className="text-red-600 dark:text-red-400" aria-hidden /> Gone quiet
            </CardTitle>
            <CardDescription>Active stores with no sale in the last 7 days.</CardDescription>
          </CardHeader>
          {d.at_risk?.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {d.at_risk.map((i) => (
                <StoreRow
                  key={i.id}
                  item={i}
                  right={
                    <>
                      <p className="text-sm text-slate-700 dark:text-slate-200">
                        {i.last_sale_at ? `last sale ${ago(i.last_sale_at)}` : 'no sales in 30 days'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{i.products_count} products</p>
                    </>
                  }
                />
              ))}
            </ul>
          ) : (
            <CardContent className="text-sm text-slate-500 dark:text-slate-400">Every active store has sold something this week.</CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}
