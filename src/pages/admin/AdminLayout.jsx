import { NavLink, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { LayoutDashboard, Store, Users, ScrollText, ShieldCheck } from 'lucide-react'
import { AdminAPI } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Notice } from './bits'
import { apiError } from './format'

// The frame around every admin page: who is looking (KashPoint staff or a
// partner), the section tabs, and a warning when the database has not had
// the portal's migration yet.
export default function AdminLayout() {
  const { isPlatformOwner } = useAuth()
  const me = useQuery({ queryKey: ['admin', 'me'], queryFn: AdminAPI.me, staleTime: 60_000 })

  const tabs = [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/stores', label: 'Stores', icon: Store },
    ...(isPlatformOwner
      ? [
          { to: '/admin/partners', label: 'Partners & staff', icon: Users },
          { to: '/admin/log', label: 'Activity log', icon: ScrollText },
        ]
      : []),
  ]

  const partner = me.data?.partner

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
            <ShieldCheck size={14} aria-hidden /> Admin portal
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white mt-1">
            {isPlatformOwner ? 'KashPoint' : partner?.name || 'Partner view'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isPlatformOwner
              ? 'Every store, trial and partner in one place.'
              : partner?.code
                ? `Stores that signed up with your code ${partner.code}.`
                : 'The stores you brought to KashPoint.'}
          </p>
        </div>
        <nav className="flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60" aria-label="Admin sections">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-soft'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                )
              }
            >
              <Icon size={16} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      {me.data?.tables_ready === false && (
        <Notice tone="warning">
          <p className="font-medium">The database has not been prepared for the portal yet.</p>
          <p className="mt-0.5">
            Run <code className="font-mono text-xs">supabase/migrations/20261108120000_admin_portal.sql</code> in the Supabase SQL Editor, then reload this page.
          </p>
        </Notice>
      )}
      {me.isError && (
        <Notice tone="danger">
          <p className="font-medium">The portal could not confirm your access.</p>
          <p className="mt-0.5">{apiError(me.error)}</p>
        </Notice>
      )}

      <Outlet context={{ me: me.data, isOwner: isPlatformOwner }} />
    </div>
  )
}
