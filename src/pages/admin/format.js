// Shared formatting and vocabulary for the admin portal pages.

export const fmtR = (n) =>
  'R ' + (Number(n) || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fmtInt = (n) => (Number(n) || 0).toLocaleString('en-ZA')

export function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** "3 days ago", "just now", "never". */
export function ago(iso, now = Date.now()) {
  if (!iso) return 'never'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const s = Math.max(0, Math.floor((now - t) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'} ago`
  const y = Math.floor(d / 365)
  return `${y} year${y === 1 ? '' : 's'} ago`
}

/** "in 12 days", "today", "3 days ago". */
export function relativeDays(iso, now = Date.now()) {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const days = Math.ceil((t - now) / 86400000)
  if (days === 0) return 'today'
  if (days > 0) return `in ${days} day${days === 1 ? '' : 's'}`
  return `${-days} day${days === -1 ? '' : 's'} ago`
}

// Badge tones for the subscription states the API reports (platform_admin.describe_subscription).
const STATE_TONES = {
  trial: 'success',
  trial_ending: 'warning',
  active: 'brand',
  comped: 'info',
  past_due: 'danger',
  trial_ended: 'warning',
  canceled: 'danger',
  expired: 'neutral',
  suspended: 'danger',
  none: 'neutral',
}

export function stateTone(state) {
  return STATE_TONES[state] || 'neutral'
}

// The filter chips on the stores list. A key is one or more states, comma-separated.
export const STATE_FILTERS = [
  { key: '', label: 'All' },
  { key: 'trial,trial_ending', label: 'On trial' },
  { key: 'active', label: 'Paying' },
  { key: 'trial_ended,expired,canceled', label: 'Lapsed' },
  { key: 'past_due', label: 'Payment failed' },
  { key: 'comped', label: 'Complimentary' },
  { key: 'suspended', label: 'Suspended' },
]

/** One line under the state badge: what happens next and when. */
export function subscriptionLine(sub, now = Date.now()) {
  if (!sub) return ''
  switch (sub.state) {
    case 'trial':
    case 'trial_ending':
      return `${sub.days_left} day${sub.days_left === 1 ? '' : 's'} left${sub.card_on_file ? ' · card saved' : ''}`
    case 'active':
      return sub.paid_through ? `renews ${fmtDate(sub.paid_through)}` : sub.card_on_file ? 'card on file' : 'active'
    case 'comped':
      return `until ${fmtDate(sub.comp_until)}`
    case 'past_due':
      return sub.paid_through ? `access until ${fmtDate(sub.paid_through)}` : 'retrying card'
    case 'trial_ended':
      return `ended ${ago(sub.trial_end, now)}`
    case 'suspended':
      return `since ${fmtDate(sub.suspended_at)}`
    case 'canceled':
    case 'expired':
      return 'on free limits'
    default:
      return ''
  }
}

const ACTION_LABELS = {
  'trial.extend': 'Extended trial',
  'comp.grant': 'Granted complimentary Pro',
  'comp.revoke': 'Ended complimentary Pro',
  'store.suspend': 'Suspended store',
  'store.unsuspend': 'Lifted suspension',
  'store.update': 'Updated store',
  'owner.password_reset': 'Sent password reset',
  'partner.create': 'Added partner',
  'partner.update': 'Updated partner',
  'partner.admin.add': 'Added partner login',
  'partner.admin.remove': 'Removed partner login',
  'admin.add': 'Added staff account',
  'admin.remove': 'Removed staff account',
}

export function actionLabel(action) {
  return ACTION_LABELS[action] || action || ''
}

/** The sign-up link a partner hands out; stores made through it carry the partner's code. */
export function partnerSignupLink(code, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  return `${origin}/auth?mode=signup&ref=${encodeURIComponent(code || '')}`
}

/** The message in an API error, or a fallback. */
export function apiError(err, fallback = 'Something went wrong.') {
  return err?.response?.data?.detail || err?.message || fallback
}
