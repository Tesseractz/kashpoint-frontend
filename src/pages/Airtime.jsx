import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Smartphone, Wallet, RefreshCw, Send, Wifi } from 'lucide-react'
import { AirtimeAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input, Select } from '../components/ui/Input'
import { Skeleton } from '../components/ui/Skeleton'

// Sell airtime and data from the till. Each shop has its own prepaid wallet
// at SIMcloud; airtime is sold at its face value, so what the shop earns is
// the service fee it adds on top.

const NETWORKS = [
  { key: 'mtn', label: 'MTN' },
  { key: 'vodacom', label: 'Vodacom' },
  { key: 'cellc', label: 'Cell C' },
  { key: 'telkom', label: 'Telkom' },
]
const QUICK_AMOUNTS = [5, 10, 12, 29, 50, 100]
const STATUS_TONE = { delivered: 'success', failed: 'danger', queued: 'warning', pending: 'warning' }

const fmtR = (n) => 'R ' + (Number(n) || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const apiError = (e) => e?.response?.data?.detail || e?.message || 'Something went wrong.'
const fmtTime = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function TopUpDetails({ topUp, cell }) {
  if (!topUp) return null
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      <dt className="text-slate-500 dark:text-slate-400">Pay to</dt>
      <dd className="font-medium text-slate-900 dark:text-white">{topUp.account_name}</dd>
      <dt className="text-slate-500 dark:text-slate-400">Bank</dt>
      <dd className="text-slate-900 dark:text-white">{topUp.bank}, branch {topUp.branch_code}</dd>
      <dt className="text-slate-500 dark:text-slate-400">Account number</dt>
      <dd className="font-medium tabular-nums text-slate-900 dark:text-white">{topUp.account_number}</dd>
      <dt className="text-slate-500 dark:text-slate-400">Reference</dt>
      <dd className="font-semibold tabular-nums text-slate-900 dark:text-white">{cell || 'your cell number'}</dd>
      <dd className="col-span-2 text-xs text-slate-500 dark:text-slate-400 mt-1">{topUp.note}</dd>
    </dl>
  )
}

function Activate({ status, isAdmin }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ first_name: '', last_name: '', cell: '', accept_terms: false })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const act = useMutation({
    mutationFn: () => AirtimeAPI.activate(form),
    onSuccess: () => {
      toast.success('Airtime is switched on')
      qc.invalidateQueries({ queryKey: ['airtime'] })
    },
    onError: (e) => toast.error(apiError(e)),
  })
  const valid = form.first_name.trim() && form.last_name.trim() && form.cell.trim().length >= 10 && form.accept_terms

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-slate-600 dark:text-slate-300">
          Airtime has not been switched on for this shop yet. Ask the owner to switch it on.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Sell airtime and data from your till</CardTitle>
        <CardDescription>
          Your shop gets its own prepaid airtime wallet. You load money into it by EFT and sell from it. Airtime is sold at its normal price; you earn the service fee you choose to add, for example R1 or R2 per sale.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) act.mutate()
          }}
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="Your first name" value={form.first_name} onChange={set('first_name')} autoComplete="given-name" />
            <Input label="Your surname" value={form.last_name} onChange={set('last_name')} autoComplete="family-name" />
          </div>
          <Input
            label="Your cell number"
            type="tel"
            inputMode="tel"
            placeholder="082 123 4567"
            value={form.cell}
            onChange={set('cell')}
            hint="This becomes your wallet's name. You use it as the reference whenever you load money."
          />
          <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.accept_terms}
              onChange={(e) => setForm((f) => ({ ...f, accept_terms: e.target.checked }))}
            />
            <span>
              I agree to SIMcloud's{' '}
              <a href="https://simcloud.co.za/legal.php" target="_blank" rel="noreferrer" className="text-brand-600 dark:text-brand-400 underline">
                terms and conditions
              </a>
              . SIMcloud (Freepaid) supplies the airtime and holds my wallet.
            </span>
          </label>
          <Button type="submit" disabled={!valid || act.isPending}>
            {act.isPending ? 'Creating your wallet…' : 'Switch on airtime'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function FeeSetting({ fee, max }) {
  const qc = useQueryClient()
  const [value, setValue] = useState(String(fee ?? 0))
  const save = useMutation({
    mutationFn: () => AirtimeAPI.setFee(Number(value) || 0),
    onSuccess: () => {
      toast.success('Service fee saved')
      qc.invalidateQueries({ queryKey: ['airtime'] })
    },
    onError: (e) => toast.error(apiError(e)),
  })
  return (
    <div>
      <div className="flex items-end gap-2">
        <div className="w-32">
          <Input label="Service fee (R)" type="number" min="0" max={max} step="0.5" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <Button variant="secondary" disabled={save.isPending || Number(value) === Number(fee)} onClick={() => save.mutate()} className="h-11">
          Save
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
        Added to every airtime or data sale. This is your profit: the airtime itself costs you its full price.
      </p>
    </div>
  )
}

function SellForm({ status }) {
  const qc = useQueryClient()
  const [kind, setKind] = useState('airtime')
  const [network, setNetwork] = useState('mtn')
  const [msisdn, setMsisdn] = useState('')
  const [amount, setAmount] = useState('')
  const [bundle, setBundle] = useState('')
  const fee = Number(status.service_fee) || 0

  const bundles = useQuery({
    queryKey: ['airtime', 'products', network],
    queryFn: () => AirtimeAPI.products(network),
    enabled: kind === 'data',
    staleTime: 10 * 60_000,
  })
  const items = bundles.data?.items || []
  const chosen = kind === 'data' ? items.find((b) => `${b.amount}|${b.description}` === bundle) : null
  const price = kind === 'airtime' ? Number(amount) || 0 : chosen?.amount || 0

  const sell = useMutation({
    mutationFn: () =>
      AirtimeAPI.sell({ kind, network, msisdn, amount: price, description: kind === 'data' ? chosen?.description : `R${price} airtime` }),
    onSuccess: () => {
      toast.success(`Sent to ${msisdn}. Collect ${fmtR(price + fee)} from the customer.`, { duration: 7000 })
      setMsisdn('')
      setAmount('')
      setBundle('')
      qc.invalidateQueries({ queryKey: ['airtime'] })
    },
    onError: (e) => toast.error(apiError(e), { duration: 7000 }),
  })

  const validCell = msisdn.replace(/\D/g, '').length >= 10
  const validAmount = kind === 'airtime' ? Number.isInteger(price) && price >= status.limits.airtime_min && price <= status.limits.airtime_max : price > 0
  const enough = status.balance == null || status.balance >= price

  return (
    <Card>
      <CardHeader>
        <CardTitle>New sale</CardTitle>
        <CardDescription>The airtime goes straight to the customer's phone. Take the money first.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2" role="group" aria-label="What to sell">
          {[
            ['airtime', 'Airtime', Smartphone],
            ['data', 'Data bundle', Wifi],
          ].map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ring-1 ring-inset ${
                kind === k ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 ring-slate-200 dark:ring-slate-700'
              }`}
            >
              <Icon size={16} aria-hidden /> {label}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Select label="Network" value={network} onChange={(e) => { setNetwork(e.target.value); setBundle('') }}>
            {NETWORKS.map((n) => (
              <option key={n.key} value={n.key}>{n.label}</option>
            ))}
          </Select>
          <Input label="Customer's cell number" type="tel" inputMode="tel" placeholder="082 123 4567" value={msisdn} onChange={(e) => setMsisdn(e.target.value)} />
        </div>

        {kind === 'airtime' ? (
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAmount(String(a))}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ring-1 ring-inset ${
                    Number(amount) === a ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 ring-slate-200 dark:ring-slate-700'
                  }`}
                >
                  R{a}
                </button>
              ))}
            </div>
            <div className="max-w-[12rem]">
              <Input label="Amount (R)" type="number" min={status.limits.airtime_min} max={status.limits.airtime_max} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
        ) : (
          <Select label="Bundle" value={bundle} onChange={(e) => setBundle(e.target.value)}>
            <option value="">{bundles.isLoading ? 'Loading bundles…' : 'Choose a bundle'}</option>
            {items.map((b) => (
              <option key={`${b.amount}|${b.description}`} value={`${b.amount}|${b.description}`}>
                {b.description} ({b.group})
              </option>
            ))}
          </Select>
        )}

        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-sm">
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>{kind === 'airtime' ? 'Airtime' : 'Bundle'}</span>
            <span className="tabular-nums">{fmtR(price)}</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>Your service fee</span>
            <span className="tabular-nums">{fmtR(fee)}</span>
          </div>
          <div className="flex justify-between font-semibold text-slate-900 dark:text-white mt-1 pt-1 border-t border-slate-200 dark:border-slate-700">
            <span>Customer pays</span>
            <span className="tabular-nums">{fmtR(price + fee)}</span>
          </div>
        </div>

        {!enough && <p className="text-sm text-red-600 dark:text-red-400">Your wallet has {fmtR(status.balance)}. Load money before selling this.</p>}

        <Button size="lg" disabled={!validCell || !validAmount || !enough || sell.isPending} onClick={() => sell.mutate()}>
          <Send size={16} /> {sell.isPending ? 'Sending…' : `Send ${fmtR(price)}`}
        </Button>
      </CardContent>
    </Card>
  )
}

export default function Airtime() {
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  const status = useQuery({ queryKey: ['airtime', 'status'], queryFn: AirtimeAPI.status })
  const activated = !!status.data?.activated
  const sales = useQuery({ queryKey: ['airtime', 'sales'], queryFn: () => AirtimeAPI.sales(30), enabled: activated, refetchInterval: 20_000 })

  if (status.isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-slate-700 dark:text-slate-200">{apiError(status.error)}</p>
          <Button variant="secondary" className="mt-4" onClick={() => status.refetch()}>Try again</Button>
        </CardContent>
      </Card>
    )
  }
  if (!status.data) return <Skeleton className="h-64 rounded-2xl" />

  const s = status.data
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Airtime & data</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">MTN, Vodacom, Cell C and Telkom, sent straight to the customer's phone.</p>
      </div>

      {!s.available && (
        <Card>
          <CardContent className="py-10 text-center text-slate-600 dark:text-slate-300">Airtime is coming soon to KashPoint.</CardContent>
        </Card>
      )}

      {s.available && !activated && <Activate status={s} isAdmin={isAdmin} />}

      {s.available && activated && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <SellForm status={s} />
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent sales</CardTitle>
                  <CardDescription>Service fees earned on these: {fmtR(sales.data?.fees_total)}</CardDescription>
                </div>
              </CardHeader>
              {sales.data?.items?.length ? (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sales.data.items.map((x) => (
                    <li key={x.id ?? x.reference} className="px-5 sm:px-6 py-3 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {x.msisdn} · {x.description || `${x.kind} ${fmtR(x.amount)}`}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {String(x.network).toUpperCase()} · {fmtTime(x.created_at)} · fee {fmtR(x.service_fee)}
                        </p>
                      </div>
                      <Badge tone={STATUS_TONE[x.status] || 'neutral'} size="sm" dot>{x.status}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <CardContent className="text-sm text-slate-500 dark:text-slate-400">No airtime sold yet.</CardContent>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet size={18} aria-hidden /> Your airtime wallet
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end justify-between gap-3">
                  <p className="font-display text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">
                    {s.balance == null ? '—' : fmtR(s.balance)}
                  </p>
                  <Button size="sm" variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ['airtime', 'status'] })}>
                    <RefreshCw size={14} /> Refresh
                  </Button>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Load money by EFT</p>
                  <TopUpDetails topUp={s.top_up} cell={s.cell} />
                </div>
              </CardContent>
            </Card>
            {isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle>What you earn</CardTitle>
                </CardHeader>
                <CardContent>
                  <FeeSetting key={s.service_fee} fee={s.service_fee} max={s.limits.max_service_fee} />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
