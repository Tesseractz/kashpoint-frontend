import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { BillingAPI, PlanAPI } from '../api/client'
import toast from 'react-hot-toast'
import { Check, X, Zap, Package, Users, FileText, Bell, Calendar, AlertTriangle, Loader2, RefreshCw, Sparkles, CreditCard, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { openExternalUrl } from '../lib/platform'
import { Badge } from '../components/ui/Badge'

const plan = {
  name: 'Pro',
  price: 'R150',
  period: '/month',
  description: 'Everything unlocked for your store',
  icon: Zap,
  iconBg: 'bg-blue-100 dark:bg-blue-900/50',
  iconColor: 'text-blue-600 dark:text-blue-400',
  features: [
    { text: 'Unlimited products', included: true },
    { text: 'Unlimited team members', included: true },
    { text: 'Advanced analytics', included: true },
    { text: 'Low stock alerts', included: true },
    { text: 'CSV export', included: true },
    { text: 'Audit logs', included: true },
  ],
  planId: 'pro',
}

function formatDate(isoString) {
  if (!isoString) return null
  try {
    return new Date(isoString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch {
    return null
  }
}

function daysUntil(isoString) {
  if (!isoString) return null
  try {
    const target = new Date(isoString)
    const now = new Date()
    const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24))
    return diff
  } catch {
    return null
  }
}

// Verification states for the post-checkout flow. Drives the inline
// banner the user sees while we confirm with Paystack.
//   idle             — no checkout in progress
//   verifying        — Paystack call in flight (after closing in-app browser, or on web success URL)
//   uncertain        — we couldn't confirm yet; show retry + manual help
//   abandoned        — Paystack says the transaction was not successful
const VERIFY = {
  IDLE: 'idle',
  VERIFYING: 'verifying',
  UNCERTAIN: 'uncertain',
  ABANDONED: 'abandoned',
}

export default function Billing() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [verifyState, setVerifyState] = useState(VERIFY.IDLE)
  const [verifyMessage, setVerifyMessage] = useState('')
  const [pendingReference, setPendingReference] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const syncAttempted = useRef(false)

  // Backward-compat for any code below that still reads `syncing`.
  const syncing = verifyState === VERIFY.VERIFYING

  const billingConfigQuery = useQuery({
    queryKey: ['billing-config'],
    queryFn: () => BillingAPI.config(),
    staleTime: 30000,
  })

  const billingProvider = (billingConfigQuery.data?.provider || 'paystack').toLowerCase()

  const planQuery = useQuery({
    queryKey: ['plan'],
    queryFn: () => PlanAPI.get(),
    staleTime: 30000,
  })

  // Direct Paystack verification using a transaction reference. Returns:
  //   { ok: true }                  — plan is now active (server already flipped it)
  //   { ok: false, abandoned: true} — Paystack says the transaction wasn't successful
  //   { ok: false }                 — transient failure; caller may retry
  const verifyByReference = async (reference) => {
    if (!reference) return { ok: false }
    try {
      const data = await BillingAPI.paystackSync(reference)
      await qc.invalidateQueries({ queryKey: ['plan'] })
      return { ok: true, data }
    } catch (e) {
      const detail = (e?.response?.data?.detail || '').toString()
      const abandoned = /not successful|abandoned|failed/i.test(detail)
      return { ok: false, abandoned, detail }
    }
  }

  useEffect(() => {
    if (billingConfigQuery.isLoading) return

    const success = searchParams.get('success') === '1'
    const canceled = searchParams.get('canceled') === '1'
    const ref = searchParams.get('reference') || searchParams.get('trxref')

    if (canceled) {
      toast('Checkout was canceled')
      setSearchParams({}, { replace: true })
      return
    }

    if (!success) return

    if (billingProvider === 'paystack' && ref && !syncAttempted.current) {
      syncAttempted.current = true
      setVerifyState(VERIFY.VERIFYING)
      setVerifyMessage('Verifying payment with Paystack…')
      ;(async () => {
        const result = await verifyByReference(ref)
        if (result.ok) {
          setVerifyState(VERIFY.IDLE)
          setPendingReference(null)
          if (!announceCardSaved(result.data)) {
            toast.success('Payment verified! Your Pro plan is now active.')
          }
        } else if (result.abandoned) {
          setVerifyState(VERIFY.ABANDONED)
          setVerifyMessage(result.detail || 'Payment was not completed.')
          setPendingReference(ref)
        } else {
          syncAttempted.current = false
          setVerifyState(VERIFY.UNCERTAIN)
          setVerifyMessage(
            result.detail ||
              'We couldn\'t reach Paystack to verify. Click "Check status" to retry.',
          )
          setPendingReference(ref)
        }
        setSearchParams({}, { replace: true })
      })()
      return
    }

    if (success) {
      toast.success('Subscription activated successfully!')
      qc.invalidateQueries({ queryKey: ['plan'] })
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, billingProvider, billingConfigQuery.isLoading, qc, setSearchParams])

  const currentPlanRaw = planQuery.data?.plan || 'expired'
  const currentPlan = currentPlanRaw === 'business' ? 'pro' : currentPlanRaw
  const status = planQuery.data?.status || 'expired'
  const isActive = planQuery.data?.is_active || false
  const limits = planQuery.data?.limits || {}
  const usage = planQuery.data?.usage || {}
  const trialEnd = planQuery.data?.trial_end
  const periodEnd = planQuery.data?.current_period_end
  const hasPaystackSubscription = planQuery.data?.has_paystack_subscription

  const trialDaysLeft = daysUntil(trialEnd)
  const isTrialing = status === 'trialing' && trialDaysLeft !== null && trialDaysLeft > 0
  // A card saved during the trial: Paystack charges the first R150 on trialEnd.
  const cardOnFile = planQuery.data?.card_on_file ?? Boolean(hasPaystackSubscription && isTrialing)
  const firstChargeDate = formatDate(periodEnd || trialEnd)

  // Manual "Check status" button on the inline verification card.
  // Same logic as the post-checkout path — verify with the reference,
  // promote to the appropriate state.
  const retryVerification = async () => {
    if (!pendingReference) return
    setVerifyState(VERIFY.VERIFYING)
    setVerifyMessage('Checking with Paystack…')
    const result = await verifyByReference(pendingReference)
    if (result.ok) {
      setVerifyState(VERIFY.IDLE)
      setPendingReference(null)
      if (!announceCardSaved(result.data)) toast.success('Subscription activated!')
    } else if (result.abandoned) {
      setVerifyState(VERIFY.ABANDONED)
      setVerifyMessage(result.detail || 'Payment was not completed.')
    } else {
      setVerifyState(VERIFY.UNCERTAIN)
      setVerifyMessage(
        result.detail ||
          'Still no confirmation. Paystack can take a minute after payment — try again shortly.',
      )
    }
  }

  const dismissVerification = () => {
    setVerifyState(VERIFY.IDLE)
    setPendingReference(null)
    setVerifyMessage('')
  }

  // After a card check: the card is saved, nothing was charged. Returns true
  // when it handled the announcement.
  function announceCardSaved(data) {
    if (data?.card_saved) {
      const when = formatDate(data.first_charge_date)
      toast.success(when ? `Card saved. Nothing is charged until ${when}.` : 'Card saved. Nothing is charged until your trial ends.')
      return true
    }
    if (data?.pending) {
      toast('Saving your card… this takes a few seconds. Refresh in a moment.')
      return true
    }
    return false
  }

  // saveCard: during the trial, save a card for later instead of paying now.
  const upgrade = async (planId, { saveCard = false } = {}) => {
    if (!saveCard && planId === currentPlan && isActive && !isTrialing) {
      toast('You are already on this plan')
      return
    }
    let reference = null
    try {
      setLoading(true)
      const email = user?.email || user?.user_metadata?.email || ''
      const checkoutResp = saveCard
        ? await BillingAPI.cardSetup({ email })
        : await BillingAPI.checkout({ plan: planId, email })
      reference = checkoutResp?.reference || null

      const opened = await openExternalUrl(checkoutResp.url)

      if (opened.kind === 'in-app-browser') {
        // Native shell: wait for the user to close Paystack, then verify.
        // Direct verification with the reference is the source of truth —
        // we no longer wait for the webhook to round-trip through the DB.
        await opened.onClosed
        setVerifyState(VERIFY.VERIFYING)
        setVerifyMessage('Verifying payment with Paystack…')

        if (!reference) {
          // Older backends didn't return a reference. Fall back to short
          // polling so an existing webhook still has a chance to land.
          let active = false
          for (let i = 0; i < 8 && !active; i++) {
            await new Promise((r) => setTimeout(r, 2500))
            try {
              const plan = await PlanAPI.get()
              if (plan?.is_active) { qc.setQueryData(['plan'], plan); active = true }
            } catch (_) {}
          }
          if (active) {
            setVerifyState(VERIFY.IDLE)
            toast.success('Subscription activated!')
          } else {
            setVerifyState(VERIFY.UNCERTAIN)
            setVerifyMessage(
              'No reference was returned by the server — we can\'t verify automatically. Refresh in a minute, or contact support if you were charged.',
            )
          }
          return
        }

        const result = await verifyByReference(reference)
        if (result.ok) {
          setVerifyState(VERIFY.IDLE)
          setPendingReference(null)
          if (!announceCardSaved(result.data)) toast.success('Subscription activated!')
        } else if (result.abandoned) {
          setVerifyState(VERIFY.ABANDONED)
          setVerifyMessage(result.detail || 'Payment was not completed.')
          setPendingReference(reference)
        } else {
          setVerifyState(VERIFY.UNCERTAIN)
          setVerifyMessage(
            result.detail ||
              'Paystack didn\'t confirm yet. Click "Check status" in a minute to retry.',
          )
          setPendingReference(reference)
        }
      }
      // Web/Electron: openExternalUrl navigated the current page; the
      // success path is handled by the `?success=1` useEffect on return.
    } catch (e) {
      setVerifyState(VERIFY.IDLE)
      toast.error(e?.response?.data?.detail || 'Failed to start checkout')
    } finally {
      setLoading(false)
    }
  }

  const cancel = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? You will lose access to Pro features.')) {
      return
    }
    try {
      setCancelLoading(true)
      await BillingAPI.cancel()
      toast.success('Subscription canceled')
      qc.invalidateQueries({ queryKey: ['plan'] })
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to cancel subscription')
    } finally {
      setCancelLoading(false)
    }
  }

  const removeCard = async () => {
    const until = formatDate(trialEnd)
    if (!window.confirm(`Remove your saved card? Your free trial continues until ${until} and you won't be charged.`)) {
      return
    }
    try {
      setCancelLoading(true)
      await BillingAPI.cancel()
      toast.success(`Card removed. Your trial continues until ${until}.`)
      qc.invalidateQueries({ queryKey: ['plan'] })
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to remove the card')
    } finally {
      setCancelLoading(false)
    }
  }

  const refreshPlan = () => {
    qc.invalidateQueries({ queryKey: ['plan'] })
    toast.success('Billing status refreshed')
  }

  const getStatusBadge = () => {
    if (syncing) {
      return (
        <Badge tone="info" icon={(props) => <Loader2 {...props} className="animate-spin" />}>
          Verifying payment…
        </Badge>
      )
    }
    if (isTrialing) {
      return (
        <Badge tone="warning" icon={Calendar} dot>
          Trial: {trialDaysLeft} days left
        </Badge>
      )
    }
    if (status === 'active') {
      return (
        <Badge tone="success" icon={Check} dot>
          Active
        </Badge>
      )
    }
    if (status === 'trialing' && isActive && cardOnFile) {
      // Trial over, card saved: Paystack is charging the first R150.
      return (
        <Badge tone="info" icon={Loader2} dot>
          First payment processing
        </Badge>
      )
    }
    if (status === 'past_due') {
      return (
        <Badge tone="danger" icon={AlertTriangle} dot>
          Payment failed
        </Badge>
      )
    }
    if (status === 'canceled') {
      return <Badge tone="neutral" dot>Canceled</Badge>
    }
    return <Badge tone="neutral" dot>No active plan</Badge>
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 text-xs font-medium ring-1 ring-brand-200/60 dark:ring-brand-900/40 mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          Pro plan
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Billing
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm sm:text-base">
          One plan. Full access. Cancel anytime.
        </p>
      </div>

      {verifyState === VERIFY.VERIFYING && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-3 justify-center">
              <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
              <p className="text-blue-800 dark:text-blue-200 font-medium">
                {verifyMessage || 'Verifying your payment with Paystack…'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {verifyState === VERIFY.UNCERTAIN && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20">
          <CardContent className="py-4 sm:py-5">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  We're still confirming your payment
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  {verifyMessage ||
                    'Paystack can take up to a minute to confirm a successful payment. Tap "Check status" to retry.'}
                </p>
                {pendingReference && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-mono break-all">
                    Reference: {pendingReference}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button size="sm" variant="primary" onClick={retryVerification}>
                    <RefreshCw className="w-4 h-4 mr-1.5" />
                    Check status
                  </Button>
                  <Button size="sm" variant="ghost" onClick={dismissVerification}>
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {verifyState === VERIFY.ABANDONED && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20">
          <CardContent className="py-4 sm:py-5">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              <X className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-red-900 dark:text-red-100">
                  Payment was not completed
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {verifyMessage ||
                    "Paystack reports this transaction as unsuccessful. Try again, or contact support if you were charged."}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button size="sm" variant="primary" onClick={() => upgrade('pro')} disabled={loading}>
                    Try again
                  </Button>
                  <Button size="sm" variant="ghost" onClick={dismissVerification}>
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {planQuery.data && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20">
          <CardContent className="py-4 sm:py-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                    Current Plan:{" "}
                    <span className="text-blue-600 dark:text-blue-400 capitalize">
                      {currentPlan}
                    </span>
                  </h3>
                  {isActive && (isTrialing ? trialEnd : periodEnd) && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {isTrialing ? "Trial ends" : "Next billing date"}:{" "}
                      {formatDate(isTrialing ? trialEnd : periodEnd)}
                    </p>
                  )}
                </div>
                {getStatusBadge()}
              </div>

              <div className="flex flex-wrap gap-2">
                {isTrialing && !cardOnFile && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => upgrade('pro', { saveCard: true })}
                    disabled={loading}
                  >
                    <CreditCard className="w-4 h-4 mr-1.5" />
                    {loading ? 'Processing...' : 'Add card'}
                  </Button>
                )}

                {!isActive && !isTrialing && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => upgrade('pro')}
                    disabled={loading}
                  >
                    {loading ? 'Processing...' : 'Upgrade to Pro'}
                  </Button>
                )}

                {isActive && !isTrialing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={cancel}
                    disabled={cancelLoading}
                  >
                    <X className="w-4 h-4 mr-2" />
                    {cancelLoading ? 'Canceling...' : 'Cancel Subscription'}
                  </Button>
                )}

                {isActive && (
                  <Button variant="ghost" size="sm" onClick={refreshPlan}>
                    <RefreshCw className="w-4 h-4 mr-1.5" />
                    Refresh
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6">
              <div className="text-center p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm min-w-0">
                <Package className="w-5 h-5 mx-auto text-blue-600 dark:text-blue-400 mb-1" />
                <p className="text-xl font-bold text-slate-800 dark:text-white">
                  {usage.products || 0}
                  {limits.max_products && (
                    <span className="text-sm font-normal text-slate-500">
                      /{limits.max_products}
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  Products
                </p>
              </div>
              <div className="text-center p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm min-w-0">
                <Users className="w-5 h-5 mx-auto text-purple-600 dark:text-purple-400 mb-1" />
                <p className="text-xl font-bold text-slate-800 dark:text-white">
                  1
                  <span className="text-sm font-normal text-slate-500">
                    /{limits.max_users || 1}
                  </span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  Users
                </p>
              </div>
              <div className="text-center p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm min-w-0">
                <FileText className="w-5 h-5 mx-auto text-emerald-600 dark:text-emerald-400 mb-1" />
                <p className="text-xl font-bold text-slate-800 dark:text-white">
                  {limits.csv_export ? (
                    <Check className="w-5 h-5 mx-auto text-emerald-500" />
                  ) : (
                    "—"
                  )}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  CSV Export
                </p>
              </div>
              <div className="text-center p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm min-w-0">
                <Bell className="w-5 h-5 mx-auto text-amber-600 dark:text-amber-400 mb-1" />
                <p className="text-xl font-bold text-slate-800 dark:text-white">
                  {limits.low_stock_alerts ? (
                    <Check className="w-5 h-5 mx-auto text-emerald-500" />
                  ) : (
                    "—"
                  )}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  Alerts
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isTrialing && !cardOnFile && (
        <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20">
          <CardContent className="py-4 sm:py-5">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-emerald-900 dark:text-emerald-100 font-semibold">
                  Keep Pro after your trial: add your card now
                </p>
                <p className="text-sm text-emerald-800 dark:text-emerald-200 mt-1">
                  You pay <strong>nothing today</strong>. Your first R150 is charged on{' '}
                  <strong>{formatDate(trialEnd)}</strong>, when your trial ends ({trialDaysLeft} days left).
                  Remove the card any time before then and you won't be charged.
                </p>
                <p className="text-xs text-emerald-700/90 dark:text-emerald-300/80 mt-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                  Paystack makes a R1 card check and refunds it straight away.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                className="sm:self-center flex-shrink-0"
                onClick={() => upgrade('pro', { saveCard: true })}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Add card'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isTrialing && cardOnFile && (
        <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20">
          <CardContent className="py-4 sm:py-5">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-emerald-900 dark:text-emerald-100 font-semibold">
                  Card saved: Pro continues after your trial
                </p>
                <p className="text-sm text-emerald-800 dark:text-emerald-200 mt-1">
                  Your first R150 payment is on <strong>{firstChargeDate}</strong>. Until then you have
                  everything free. Remove the card before then and you won't be charged.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="sm:self-center flex-shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={removeCard}
                disabled={cancelLoading}
              >
                {cancelLoading ? 'Removing...' : 'Remove card'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isActive && !isTrialing && verifyState === VERIFY.IDLE && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-amber-800 dark:text-amber-200 font-medium">
                  {status === 'trialing' ? 'Your free trial has ended' : 'Your subscription is not active'}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Subscribe for {plan.price}{plan.period} to unlock all features.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isActive && !isTrialing && currentPlan === 'pro' && (
        <div className="text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            You have full access to all Pro features. There is no higher plan.
          </p>
        </div>
      )}

      <div className="mt-8 max-w-2xl mx-auto">
        <Card className="relative overflow-hidden border-brand-200 dark:border-brand-900/50 shadow-soft-xl">
          {/* Hero gradient accent */}
          <div className="absolute inset-x-0 top-0 h-1.5 bg-brand-gradient" aria-hidden />
          <div className="pointer-events-none absolute -top-32 -right-32 w-72 h-72 rounded-full bg-brand-100/60 dark:bg-brand-900/20 blur-3xl" aria-hidden />

          <CardContent className="relative p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="w-12 h-12 bg-brand-gradient rounded-2xl flex items-center justify-center mb-4 shadow-brand">
                  <plan.icon className="w-6 h-6 text-white" />
                </div>
                {/* Inline, not pinned to the corner: on a phone the corner
                    badge sat on top of the price and hid the "0" of R150. */}
                <h3 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                  {plan.name}
                  {currentPlan === 'pro' && <Badge tone="success" icon={Check} size="md">Current</Badge>}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {plan.description}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-baseline justify-end gap-0.5">
                  <span className="font-display text-4xl sm:text-5xl font-bold tabular-nums text-slate-900 dark:text-white">
                    {plan.price}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-sm">
                    {plan.period}
                  </span>
                </div>
                <p className="text-xs text-accent-600 dark:text-accent-400 font-medium mt-2">
                  Cancel anytime
                </p>
              </div>
            </div>

            <div className="mt-6">
              {(currentPlan === 'pro' && isActive && !isTrialing) ? (
                <Button variant="secondary" className="w-full" disabled>
                  Current plan: Pro
                </Button>
              ) : isTrialing && cardOnFile ? (
                <Button variant="secondary" className="w-full" disabled>
                  <Check className="w-4 h-4 mr-1.5" />
                  Card saved, first payment {firstChargeDate}
                </Button>
              ) : isTrialing ? (
                <>
                  <Button
                    variant="primary"
                    className="w-full"
                    size="lg"
                    onClick={() => upgrade(plan.planId, { saveCard: true })}
                    disabled={loading}
                  >
                    {loading ? 'Processing...' : 'Add card: pay R0 today'}
                  </Button>
                  <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-2">
                    First R150 on {formatDate(trialEnd)}. Remove the card any time before then.
                  </p>
                </>
              ) : (
                <Button
                  variant="primary"
                  className="w-full"
                  size="lg"
                  onClick={() => upgrade(plan.planId)}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : `Subscribe — ${plan.price}${plan.period}`}
                </Button>
              )}
            </div>

            <div className="mt-7 pt-6 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                Included
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
                {plan.features.map((feature, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"
                  >
                    <span className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full bg-accent-100 dark:bg-accent-950/60 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-accent-700 dark:text-accent-300" />
                    </span>
                    <span>{feature.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardContent className="py-6 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            Need a custom plan for your enterprise?{" "}
            <a
              href="mailto:support@kashpoint.com"
              className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
            >
              Contact our sales team
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
