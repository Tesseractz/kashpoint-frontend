import { useEffect, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft, Clock, Gift, Ban, KeyRound, Save, ShieldCheck, ExternalLink } from 'lucide-react'
import { AdminAPI } from '../../api/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input, Select } from '../../components/ui/Input'
import { Dialog } from '../../components/ui/Dialog'
import { Skeleton } from '../../components/ui/Skeleton'
import { StateBadge, Field, PageError, Notice, Details } from './bits'
import { fmtR, fmtInt, fmtDate, fmtDateTime, ago, relativeDays, subscriptionLine, actionLabel, apiError } from './format'

const inputClass =
  'w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:shadow-focus-ring'

function useAdminAction(mutationFn, { onSuccess } = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin'] })
      onSuccess?.(data)
    },
    onError: (e) => toast.error(apiError(e)),
  })
}

// ---------------------------------------------------------------------------
// Dialogs for the staff actions
// ---------------------------------------------------------------------------

function TrialDialog({ open, onClose, storeId, sub }) {
  const [days, setDays] = useState('14')
  const [custom, setCustom] = useState('')
  const n = days === 'custom' ? Number(custom) : Number(days)
  const act = useAdminAction((d) => AdminAPI.extendTrial(storeId, d), {
    onSuccess: (res) => {
      toast.success(`Trial now ends ${fmtDate(res.trial_end)}`)
      if (res.note) toast(res.note, { duration: 10000, icon: '💳' })
      onClose()
    },
  })
  const ended = sub && !['trial', 'trial_ending'].includes(sub.state)
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Extend the trial"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!(n >= 1 && n <= 365) || act.isPending} onClick={() => act.mutate(n)}>
            {act.isPending ? 'Saving…' : `Add ${n || 0} day${n === 1 ? '' : 's'}`}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {ended
          ? 'This store is not on a trial right now. The days are counted from today and the store goes back to Pro at once.'
          : `The days are added to the ${sub?.days_left ?? ''} left, so nothing the store was promised is lost.`}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {['7', '14', '30', 'custom'].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setDays(v)}
            aria-pressed={days === v}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ring-1 ring-inset ${
              days === v ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 ring-slate-200 dark:ring-slate-700'
            }`}
          >
            {v === 'custom' ? 'Other' : `${v} days`}
          </button>
        ))}
      </div>
      {days === 'custom' && (
        <div className="mt-3 max-w-[10rem]">
          <Input type="number" min="1" max="365" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Days" aria-label="Number of days" />
        </div>
      )}
    </Dialog>
  )
}

function CompDialog({ open, onClose, storeId }) {
  const [mode, setMode] = useState('months')
  const [months, setMonths] = useState('3')
  const [until, setUntil] = useState('')
  const [reason, setReason] = useState('')
  const act = useAdminAction((body) => AdminAPI.grantComp(storeId, body), {
    onSuccess: (res) => {
      toast.success(`Pro on the house until ${fmtDate(res.comp_until)}`)
      onClose()
    },
  })
  const body = mode === 'months' ? { months: Number(months), reason: reason || undefined } : { until, reason: reason || undefined }
  const valid = mode === 'months' ? Number(months) >= 1 : /^\d{4}-\d{2}-\d{2}$/.test(until)
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Give Pro for free"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || act.isPending} onClick={() => act.mutate(body)}>
            {act.isPending ? 'Saving…' : 'Grant Pro'}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">
        The store gets every Pro feature until the date, whatever its billing says. Useful for a partner's demo till or to say sorry after a problem.
      </p>
      <div className="mt-4 space-y-3">
        <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
          <input type="radio" name="comp-mode" checked={mode === 'months'} onChange={() => setMode('months')} />
          <span>For</span>
          <select className={`${inputClass} w-28 py-1.5`} value={months} onChange={(e) => setMonths(e.target.value)} disabled={mode !== 'months'} aria-label="Months">
            {[1, 2, 3, 6, 12].map((m) => (
              <option key={m} value={m}>{m} month{m === 1 ? '' : 's'}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
          <input type="radio" name="comp-mode" checked={mode === 'until'} onChange={() => setMode('until')} />
          <span>Until</span>
          <input type="date" className={`${inputClass} w-44 py-1.5`} value={until} onChange={(e) => setUntil(e.target.value)} disabled={mode !== 'until'} aria-label="End date" />
        </label>
        <Input label="Reason (shown in the activity log)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. TechZone demo till" maxLength={300} />
      </div>
    </Dialog>
  )
}

function SuspendDialog({ open, onClose, storeId, name }) {
  const [reason, setReason] = useState('')
  const act = useAdminAction(() => AdminAPI.suspend(storeId, reason || undefined), {
    onSuccess: () => {
      toast.success('Store suspended')
      onClose()
    },
  })
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Suspend ${name}?`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={act.isPending} onClick={() => act.mutate()}>
            {act.isPending ? 'Suspending…' : 'Suspend store'}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">
        The store drops to the free limits (10 products, 1 user) and sees a banner asking them to contact support. Paying does not lift it; only you can, from this page. Sales already made are untouched.
      </p>
      <div className="mt-4">
        <Input label="Reason (shown in the activity log)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. chargeback on October invoice" maxLength={300} />
      </div>
    </Dialog>
  )
}

function ResetDialog({ open, onClose, storeId, email }) {
  const act = useAdminAction(() => AdminAPI.passwordReset(storeId), {
    onSuccess: (res) => {
      toast.success(`Reset link sent to ${res.email}`)
      onClose()
    },
  })
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Send a password-reset email"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={act.isPending} onClick={() => act.mutate()}>
            {act.isPending ? 'Sending…' : 'Send email'}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">
        The owner at <span className="font-medium text-slate-900 dark:text-white">{email || 'their email'}</span> gets the same link the "Forgot password" form sends. You never see their password.
      </p>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

function PartnerNotesCard({ store, partners, isOwner }) {
  const [partnerId, setPartnerId] = useState(store.partner_id || '')
  const [notes, setNotes] = useState(store.admin_notes || '')
  useEffect(() => {
    setPartnerId(store.partner_id || '')
    setNotes(store.admin_notes || '')
  }, [store.partner_id, store.admin_notes])
  const dirty = (store.partner_id || '') !== partnerId || (store.admin_notes || '') !== notes
  const act = useAdminAction(() => AdminAPI.updateStore(store.id, { partner_id: partnerId || null, admin_notes: notes }), {
    onSuccess: () => toast.success('Saved'),
  })
  if (!isOwner) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Partner & notes</CardTitle>
        <CardDescription>Staff only. The store never sees this.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select label="Partner" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
          <option value="">No partner</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
          ))}
        </Select>
        <div>
          <label htmlFor="admin-notes" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Notes</label>
          <textarea id="admin-notes" rows={4} className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="Who you spoke to, what they asked for, what was promised…" />
        </div>
        <div className="flex justify-end">
          <Button size="sm" disabled={!dirty || act.isPending} onClick={() => act.mutate()}>
            <Save size={14} /> {act.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminStoreDetail() {
  const { storeId } = useParams()
  const { isOwner } = useOutletContext() || {}
  const [dialog, setDialog] = useState(null)
  const q = useQuery({ queryKey: ['admin', 'store', storeId], queryFn: () => AdminAPI.store(storeId) })

  const revoke = useAdminAction(() => AdminAPI.revokeComp(storeId), { onSuccess: () => toast.success('Complimentary Pro ended') })
  const unsuspend = useAdminAction(() => AdminAPI.unsuspend(storeId), { onSuccess: () => toast.success('Suspension lifted') })

  if (q.isError) return <PageError error={q.error} onRetry={() => q.refetch()} />
  if (!q.data) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    )
  }

  const { store, summary, users, subscription: sub, usage, actions, partners } = q.data
  const s = summary.subscription
  const paying = s.paying
  const owner = users.find((u) => u.is_owner)

  return (
    <div className="space-y-5">
      <div>
        <Link to="/admin/stores" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">
          <ArrowLeft size={14} aria-hidden /> All stores
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white truncate">{store.name}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Signed up {fmtDate(store.created_at)} ({ago(store.created_at)})
              {summary.partner ? ` · via ${summary.partner.name}` : ''}
            </p>
          </div>
          <div className="text-right">
            <StateBadge sub={s} />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subscriptionLine(s)}</p>
          </div>
        </div>
      </div>

      {q.data.auth_unavailable && <Notice tone="warning">Supabase Auth did not answer, so emails and sign-ins are missing on this load.</Notice>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Subscription</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="Status">
                  <StateBadge sub={s} size="sm" />
                </Field>
                <Field label="Trial ends">{s.trial_end ? `${fmtDate(s.trial_end)} (${relativeDays(s.trial_end)})` : null}</Field>
                <Field label="Paid through">{s.paid_through ? `${fmtDate(s.paid_through)} (${relativeDays(s.paid_through)})` : null}</Field>
                <Field label="Card on file">{s.card_on_file ? 'Yes, Paystack charges it' : 'No'}</Field>
                <Field label="Complimentary until">{s.comp_until ? fmtDate(s.comp_until) : null}</Field>
                <Field label="Suspended">{s.suspended_at ? `since ${fmtDateTime(s.suspended_at)}` : 'No'}</Field>
                <Field label="Raw plan / status">{sub?.plan ? `${sub.plan} / ${sub.status}` : 'no row'}</Field>
                <Field label="Trial used">{sub?.trial_consumed_at ? fmtDate(sub.trial_consumed_at) : 'not yet'}</Field>
                {isOwner && <Field label="Paystack customer">{sub?.paystack_customer_code}</Field>}
              </dl>
              {isOwner && (
                <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                  {!paying && (
                    <Button size="sm" variant="secondary" onClick={() => setDialog('trial')}>
                      <Clock size={14} /> Extend trial
                    </Button>
                  )}
                  {s.state === 'comped' ? (
                    <Button size="sm" variant="secondary" disabled={revoke.isPending} onClick={() => revoke.mutate()}>
                      <Gift size={14} /> End complimentary Pro
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setDialog('comp')}>
                      <Gift size={14} /> Give Pro for free
                    </Button>
                  )}
                  {s.state === 'suspended' ? (
                    <Button size="sm" variant="success" disabled={unsuspend.isPending} onClick={() => unsuspend.mutate()}>
                      <ShieldCheck size={14} /> Lift suspension
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="text-red-700 border-red-200 hover:bg-red-50 dark:text-red-300 dark:border-red-900/60 dark:hover:bg-red-900/20" onClick={() => setDialog('suspend')}>
                      <Ban size={14} /> Suspend
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setDialog('reset')}>
                    <KeyRound size={14} /> Send password reset
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Field label="Last sale">{usage.last_sale_at ? ago(usage.last_sale_at) : 'none in 30 days'}</Field>
                <Field label="Sales, 30 days">{`${fmtInt(usage.sales_30d_count)} · ${fmtR(usage.sales_30d_total)}`}</Field>
                <Field label="Sales, all time">{`${fmtInt(usage.sales_total_count)} · ${fmtR(usage.sales_total_amount)}`}</Field>
                <Field label="Products">{fmtInt(usage.products)}</Field>
                <Field label="Customers">{fmtInt(usage.customers)}</Field>
                <Field label="Owner last seen">{owner?.last_sign_in_at ? ago(owner.last_sign_in_at) : 'never signed in'}</Field>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>People</CardTitle>
              <CardDescription>{users.length} account{users.length === 1 ? '' : 's'} on this store.</CardDescription>
            </CardHeader>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map((u) => (
                <li key={u.id} className="px-5 sm:px-6 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {u.email || u.name || u.id}
                      {u.is_owner && <Badge tone="brand" size="sm" className="ml-2">owner</Badge>}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {u.role}{u.name && u.email ? ` · ${u.name}` : ''} · {u.last_sign_in_at ? `seen ${ago(u.last_sign_in_at)}` : 'never signed in'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <PartnerNotesCard store={store} partners={partners || []} isOwner={isOwner} />

          <Card>
            <CardHeader>
              <CardTitle>Store details</CardTitle>
              <CardDescription>What the owner entered under Profile.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-3">
                <Field label="Owner">{owner?.email}</Field>
                <Field label="Phone">{store.phone}</Field>
                <Field label="Email on receipts">{store.email}</Field>
                <Field label="Address">{store.address}</Field>
                <Field label="VAT number">{store.vat_number}</Field>
                <Field label="Registration">{store.registration_number}</Field>
                <Field label="Website">
                  {store.website ? (
                    <a href={store.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 hover:underline">
                      {store.website} <ExternalLink size={12} aria-hidden />
                    </a>
                  ) : null}
                </Field>
              </dl>
            </CardContent>
          </Card>

          {isOwner && (
            <Card>
              <CardHeader>
                <CardTitle>Staff actions on this store</CardTitle>
              </CardHeader>
              {actions?.length ? (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {actions.map((a) => (
                    <li key={a.id} className="px-5 sm:px-6 py-3">
                      <p className="text-sm text-slate-900 dark:text-white">{actionLabel(a.action)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {a.actor_email} · {fmtDateTime(a.created_at)}
                      </p>
                      <Details details={a.details} />
                    </li>
                  ))}
                </ul>
              ) : (
                <CardContent className="text-sm text-slate-500 dark:text-slate-400">Nothing yet.</CardContent>
              )}
            </Card>
          )}
        </div>
      </div>

      {isOwner && (
        <>
          <TrialDialog open={dialog === 'trial'} onClose={() => setDialog(null)} storeId={storeId} sub={s} />
          <CompDialog open={dialog === 'comp'} onClose={() => setDialog(null)} storeId={storeId} />
          <SuspendDialog open={dialog === 'suspend'} onClose={() => setDialog(null)} storeId={storeId} name={store.name} />
          <ResetDialog open={dialog === 'reset'} onClose={() => setDialog(null)} storeId={storeId} email={owner?.email} />
        </>
      )}
    </div>
  )
}
