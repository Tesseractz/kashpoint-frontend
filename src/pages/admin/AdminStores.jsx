import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Search, Store, ArrowRight } from 'lucide-react'
import { AdminAPI } from '../../api/client'
import { Card } from '../../components/ui/Card'
import { Input, Select } from '../../components/ui/Input'
import { EmptyState } from '../../components/ui/EmptyState'
import { Skeleton } from '../../components/ui/Skeleton'
import { StateBadge, PageError, Notice } from './bits'
import { fmtR, fmtDate, ago, subscriptionLine, STATE_FILTERS } from './format'

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export default function AdminStores() {
  const { isOwner } = useOutletContext() || {}
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const state = params.get('state') || ''
  const partnerId = params.get('partner') || ''
  const debouncedQ = useDebounced(q)

  useEffect(() => {
    const next = new URLSearchParams(params)
    if (debouncedQ) next.set('q', debouncedQ)
    else next.delete('q')
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ])

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const query = useMemo(
    () => ({ q: debouncedQ, state, partner_id: partnerId }),
    [debouncedQ, state, partnerId],
  )
  const list = useQuery({
    queryKey: ['admin', 'stores', query],
    queryFn: () => AdminAPI.stores(query),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })

  const items = list.data?.items || []
  const partners = list.data?.partners || []

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex-1">
          <Input
            icon={Search}
            placeholder="Search by shop, owner email or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search stores"
          />
        </div>
        {isOwner && partners.length > 0 && (
          <div className="lg:w-56">
            <Select value={partnerId} onChange={(e) => setFilter('partner', e.target.value)} aria-label="Filter by partner">
              <option value="">All partners</option>
              <option value="none">No partner</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
        {STATE_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter('state', f.key)}
            aria-pressed={state === f.key}
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors ring-1 ring-inset',
              state === f.key
                ? 'bg-brand-600 text-white ring-brand-600'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 ring-slate-200 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list.isError && <PageError error={list.error} onRetry={() => list.refetch()} />}
      {list.data?.auth_unavailable && (
        <Notice tone="warning">Supabase Auth did not answer, so owner emails and sign-ins are missing on this load.</Notice>
      )}

      {!list.data && !list.isError && (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      )}

      {list.data && items.length === 0 && (
        <Card>
          <EmptyState
            icon={Store}
            title={debouncedQ || state || partnerId ? 'No stores match' : 'No stores yet'}
            description={debouncedQ || state || partnerId ? 'Try another search or clear the filters.' : 'Stores appear here the moment someone signs up.'}
            compact
          />
        </Card>
      )}

      {items.length > 0 && (
        <>
          <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
            {list.data.total} store{list.data.total === 1 ? '' : 's'}
            {list.isFetching && list.data ? ' · updating…' : ''}
          </p>

          {/* Wide screens: a table. */}
          <Card className="hidden lg:block overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-5 py-3">Store</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  {isOwner && <th scope="col" className="px-4 py-3">Partner</th>}
                  <th scope="col" className="px-4 py-3">Activity</th>
                  <th scope="col" className="px-4 py-3 text-right">30 days</th>
                  <th scope="col" className="px-4 py-3">Signed up</th>
                  <th scope="col" className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/admin/stores/${s.id}`)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <Link to={`/admin/stores/${s.id}`} className="font-medium text-slate-900 dark:text-white hover:underline" onClick={(e) => e.stopPropagation()}>
                        {s.name}
                      </Link>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[16rem]">
                        {s.owner_email || '—'}
                        {s.phone ? ` · ${s.phone}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StateBadge sub={s.subscription} size="sm" />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subscriptionLine(s.subscription)}</p>
                    </td>
                    {isOwner && (
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {s.partner ? s.partner.name : <span className="text-slate-400">—</span>}
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      <p>{s.last_sale_at ? `sold ${ago(s.last_sale_at)}` : 'no sales in 30 days'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {s.last_sign_in_at ? `seen ${ago(s.last_sign_in_at)}` : 'never signed in'} · {s.users_count} user{s.users_count === 1 ? '' : 's'} · {s.products_count} products
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      <p>{fmtR(s.sales_30d_total)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{s.sales_30d_count} sales</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">{fmtDate(s.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <ArrowRight size={16} className="inline text-slate-400" aria-hidden />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Phones and tablets: cards. */}
          <ul className="lg:hidden space-y-2">
            {items.map((s) => (
              <li key={s.id}>
                <Link to={`/admin/stores/${s.id}`} className="block">
                  <Card hover className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-white truncate">{s.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{s.owner_email || s.phone || '—'}</p>
                      </div>
                      <StateBadge sub={s.subscription} size="sm" />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                      <span>{subscriptionLine(s.subscription)}</span>
                      <span>{s.last_sale_at ? `sold ${ago(s.last_sale_at)}` : 'no sales in 30 days'}</span>
                      <span>{fmtR(s.sales_30d_total)} / 30 d</span>
                      {isOwner && s.partner && <span>via {s.partner.name}</span>}
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
