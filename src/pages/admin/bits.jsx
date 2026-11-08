import clsx from 'clsx'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { apiError, stateTone } from './format'

/** The subscription state as a pill. */
export function StateBadge({ sub, size = 'md' }) {
  if (!sub) return null
  return (
    <Badge tone={stateTone(sub.state)} size={size} dot>
      {sub.label}
    </Badge>
  )
}

/** A labelled value inside a <dl>. */
export function Field({ label, children, className = '' }) {
  const empty = children === null || children === undefined || children === ''
  return (
    <div className={clsx('min-w-0', className)}>
      <dt className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900 dark:text-slate-100 break-words">{empty ? '—' : children}</dd>
    </div>
  )
}

const noticeTones = {
  warning: 'border-amber-200 dark:border-amber-900 bg-amber-50/90 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200',
  danger: 'border-red-200 dark:border-red-900 bg-red-50/90 dark:bg-red-950/40 text-red-900 dark:text-red-200',
  info: 'border-sky-200 dark:border-sky-900 bg-sky-50/90 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200',
}

export function Notice({ tone = 'warning', children, className = '' }) {
  return (
    <div role="alert" className={clsx('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm', noticeTones[tone] || noticeTones.warning, className)}>
      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function PageError({ error, onRetry }) {
  return (
    <Notice tone="danger">
      <p className="font-medium">Could not load this page.</p>
      <p className="mt-0.5 opacity-90">{apiError(error)}</p>
      {onRetry && (
        <Button size="sm" variant="secondary" className="mt-3" onClick={onRetry}>
          <RefreshCw size={14} /> Try again
        </Button>
      )}
    </Notice>
  )
}

/** A small key/value rendering of an action's details JSON. */
export function Details({ details }) {
  if (!details || typeof details !== 'object') return null
  const entries = Object.entries(details).filter(([, v]) => v !== null && v !== undefined && v !== '')
  if (!entries.length) return null
  return (
    <span className="text-xs text-slate-500 dark:text-slate-400">
      {entries.map(([k, v], i) => (
        <span key={k}>
          {i > 0 && ' · '}
          <span className="font-medium">{k}:</span> {Array.isArray(v) ? v.join(', ') : String(v)}
        </span>
      ))}
    </span>
  )
}
