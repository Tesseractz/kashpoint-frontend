import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CreditCard, Sparkles, AlertTriangle, X } from 'lucide-react'
import { Button } from './ui/Button'
import { usePlan } from '../hooks/usePlan'
import { useAuth } from '../context/AuthContext'

// A slim strip at the top of every page that turns trial days into paying
// shops: how long is left, that adding a card costs nothing today, and — once
// the trial is over — what it takes to get Pro back. Owners only: cashiers
// can't pay, and shouldn't be nagged.

const DISMISS_KEY = 'kashpoint.trialBanner.dismissedOn'
const DAY = 24 * 60 * 60 * 1000

function today() {
  return new Date().toISOString().slice(0, 10)
}

function dismissedToday() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === today()
  } catch {
    return false
  }
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' })
  } catch {
    return null
  }
}

// What to say, or null for nothing. Exported for tests.
export function trialBannerState(plan, now = Date.now()) {
  if (!plan || plan.degraded) return null
  if (plan.is_on_trial) {
    if (plan.card_on_file) return null
    const end = plan.trial_end ? new Date(plan.trial_end).getTime() : NaN
    if (Number.isNaN(end)) return null
    const daysLeft = Math.max(1, Math.ceil((end - now) / DAY))
    return { kind: daysLeft <= 7 ? 'ending' : 'trial', daysLeft, endDate: formatDate(plan.trial_end) }
  }
  // Trial used up and nothing paid: the store is on the free limits now.
  if (!plan.is_active && plan.trial_end && ['trialing', 'expired', 'canceled'].includes(plan.status)) {
    return { kind: 'ended', canceled: plan.status === 'canceled' }
  }
  return null
}

export default function TrialBanner() {
  const { profile } = useAuth()
  const { plan, isFetchedAfterMount } = usePlan()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [hidden, setHidden] = useState(dismissedToday)

  if (hidden || pathname.startsWith('/billing')) return null
  if (profile?.role && profile.role !== 'admin') return null
  // A remembered plan may be days old; only nag on a fresh answer.
  if (!isFetchedAfterMount) return null

  const state = trialBannerState(plan)
  if (!state) return null

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, today())
    } catch {
      /* storage unavailable: hide for this visit only */
    }
    setHidden(true)
  }

  const tone = {
    trial: 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/90 dark:bg-emerald-950/40',
    ending: 'border-amber-200 dark:border-amber-900 bg-amber-50/90 dark:bg-amber-950/40',
    ended: 'border-red-200 dark:border-red-900 bg-red-50/90 dark:bg-red-950/40',
  }[state.kind]
  const Icon = state.kind === 'ended' ? AlertTriangle : state.kind === 'ending' ? CreditCard : Sparkles
  const iconColor = {
    trial: 'text-emerald-600 dark:text-emerald-400',
    ending: 'text-amber-600 dark:text-amber-400',
    ended: 'text-red-600 dark:text-red-400',
  }[state.kind]

  let title
  let body
  if (state.kind === 'ended') {
    title = state.canceled ? 'Your Pro plan has ended' : 'Your free trial has ended'
    body = 'Your shop is on the free plan now: 10 products and 1 user. Subscribe for R150/month to unlock everything again.'
  } else {
    const days = `${state.daysLeft} day${state.daysLeft === 1 ? '' : 's'}`
    title = state.kind === 'ending' ? `Your free trial ends in ${days}` : `Free trial: ${days} left`
    body = `Add your card to keep Pro after ${state.endDate}. You pay nothing until then, and you can remove it any time.`
  }

  return (
    <div className={`shrink-0 border-b px-3 sm:px-6 py-2.5 ${tone}`} role="status">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <Icon className={`w-5 h-5 flex-shrink-0 ${iconColor}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 hidden sm:block">{body}</p>
        </div>
        <Button size="sm" variant="primary" className="flex-shrink-0" onClick={() => navigate('/billing')}>
          {state.kind === 'ended' ? 'Subscribe' : 'Add card'}
        </Button>
        <button
          type="button"
          onClick={dismiss}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-black/5 dark:hover:bg-white/10 flex-shrink-0"
          aria-label="Hide until tomorrow"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
