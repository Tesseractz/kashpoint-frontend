import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Smartphone, Wallet, RefreshCw, Send, Wifi, Zap, Gift } from 'lucide-react'
import { AirtimeAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { Skeleton } from '../components/ui/Skeleton'
import { Dialog } from '../components/ui/Dialog'

// Sell airtime and data from the till. Each shop has its own prepaid wallet
// at SIMcloud; airtime is sold at its face value, so what the shop earns is
// the service fee it adds on top.

// Each network shown by its logo so a cashier finds it by sight. Logo files
// live in public/networks/<key>.svg; a network without one (or whose file
// fails to load) falls back to a tile in its brand colour.
const NETWORKS = [
  { key: 'mtn', label: 'MTN', logo: true, logoBg: 'bg-[#ffcb05]', tile: 'bg-[#ffcb05] text-black', mark: 'MTN' },
  { key: 'vodacom', label: 'Vodacom', logo: false, logoBg: 'bg-white', tile: 'bg-[#e60000] text-white', mark: 'V' },
  { key: 'cellc', label: 'Cell C', logo: true, logoBg: 'bg-white', tile: 'bg-black text-white', mark: 'C' },
  { key: 'telkom', label: 'Telkom', logo: true, logoBg: 'bg-white', tile: 'bg-[#0083c2] text-white', mark: 'T' },
]
const networkOf = (key) => NETWORKS.find((n) => n.key === key)

function NetworkMark({ network, size = 'md' }) {
  const n = networkOf(network)
  const [broken, setBroken] = useState(false)
  if (!n) return null
  const box = size === 'sm' ? 'w-10 h-8 text-[10px]' : size === 'lg' ? 'w-20 h-12 text-sm' : 'w-14 h-11 text-xs'
  if (n.logo && !broken) {
    return (
      <span className={`inline-flex items-center justify-center rounded-xl flex-shrink-0 p-1.5 ring-1 ring-slate-200 dark:ring-slate-700 ${box} ${n.logoBg}`}>
        <img src={`/networks/${n.key}.svg`} alt="" className="max-w-full max-h-full object-contain" onError={() => setBroken(true)} />
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center justify-center rounded-xl font-extrabold tracking-tight flex-shrink-0 ${box} ${n.tile}`} aria-hidden>
      {n.mark}
    </span>
  )
}

// "1.5GB-R99" → "1.5GB"; "1GB-R33(20day)" → "1GB (20day)". The price is shown separately.
function bundleName(description) {
  const text = String(description || '')
  const m = text.match(/^(.*?)-R[\d.]+(.*)$/)
  return m ? `${m[1]}${m[2] ? ` ${m[2].trim()}` : ''}`.trim() : text
}

function BundlePicker({ network, items, loading, value, onChange }) {
  const [group, setGroup] = useState('')
  const groups = [...new Set(items.map((b) => b.group).filter(Boolean))]
  const shown = (group ? items.filter((b) => b.group === group) : items).slice().sort((a, b) => a.amount - b.amount)
  useEffect(() => setGroup(''), [network])

  if (loading) return <Skeleton className="h-40 rounded-2xl" />
  if (!items.length) return <p className="text-sm text-slate-500 dark:text-slate-400">No bundles available for this network right now.</p>

  return (
    <div>
      <p className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Bundle</p>
      <div className="flex flex-wrap gap-1.5 mb-3" role="group" aria-label="Bundle type">
        {['', ...groups].map((g) => (
          <button
            key={g || 'all'}
            type="button"
            onClick={() => setGroup(g)}
            aria-pressed={group === g}
            className={`px-3 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${
              group === g ? 'bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900 dark:ring-white' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 ring-slate-200 dark:ring-slate-700'
            }`}
          >
            {g || 'All'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto pr-1" role="radiogroup" aria-label="Bundle">
        {shown.map((b) => {
          const id = `${b.amount}|${b.description}`
          const on = value === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(id)}
              className={`rounded-2xl p-3 text-left ring-2 ring-inset transition-all ${
                on ? 'ring-brand-600 bg-brand-50 dark:bg-brand-950/40' : 'ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-900 hover:ring-slate-300'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-display text-base font-semibold text-slate-900 dark:text-white leading-tight">{bundleName(b.description)}</span>
                <NetworkMark network={network} size="sm" />
              </span>
              <span className="block mt-1 text-sm font-semibold tabular-nums text-brand-700 dark:text-brand-300">{fmtR(b.amount)}</span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">{b.group}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
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

function FeeSetting({ fee, max, field = 'service_fee', label = 'Service fee (R)' }) {
  const qc = useQueryClient()
  const [value, setValue] = useState(String(fee ?? 0))
  const save = useMutation({
    mutationFn: () => AirtimeAPI.setFees({ [field]: Number(value) || 0 }),
    onSuccess: () => {
      toast.success('Service fee saved')
      qc.invalidateQueries({ queryKey: ['airtime'] })
    },
    onError: (e) => toast.error(apiError(e)),
  })
  return (
    <div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input label={label} type="number" min="0" max={max} step="0.5" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <Button variant="secondary" disabled={save.isPending || Number(value) === Number(fee)} onClick={() => save.mutate()} className="h-11">
          Save
        </Button>
      </div>
    </div>
  )
}

function SwitchOff({ status }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const off = useMutation({
    mutationFn: AirtimeAPI.switchOff,
    onSuccess: () => {
      toast.success('Airtime switched off for this shop')
      setOpen(false)
      qc.invalidateQueries({ queryKey: ['airtime'] })
    },
    onError: (e) => toast.error(apiError(e)),
  })
  const hasMoney = Number(status.balance) > 0
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-red-600 dark:text-red-400 hover:underline">
        Switch off airtime for this shop
      </button>
      <Dialog
        open={open}
        onOpenChange={(o) => !o && setOpen(false)}
        title="Switch off airtime?"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Keep it on</Button>
            <Button variant="danger" disabled={off.isPending} onClick={() => off.mutate()}>
              {off.isPending ? 'Switching off…' : 'Switch off'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <p>This shop will stop selling airtime and the wallet for <span className="font-semibold text-slate-900 dark:text-white">{status.cell}</span> is disconnected from KashPoint. Your past airtime sales stay in your history.</p>
          {hasMoney && (
            <p className="rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 px-3 py-2">
              There is still {fmtR(status.balance)} in the wallet. It stays there. Sell it first, or switch on again later with the same cell number to get it back.
            </p>
          )}
          <p>The wallet itself is held by SIMcloud and is not deleted. To switch on with a different cell number afterwards, just enter the new number. To close the SIMcloud account completely, contact SIMcloud.</p>
        </div>
      </Dialog>
    </>
  )
}

// What SIMcloud keeps out of an electricity purchase: 3/103 of it, capped at
// R10, in whole rands. R150 buys R146 of electricity. (Mirrors the API.)
const electricityFee = (amount) => Math.min(10, Math.floor((amount * 3) / 103))
const ELECTRICITY_QUICK = [60, 100, 150, 200, 300, 500]

function Summary({ rows, total }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-sm">
      {rows.map(([label, value, muted]) => (
        <div key={label} className={`flex justify-between ${muted ? 'text-slate-400 dark:text-slate-500 text-xs' : 'text-slate-600 dark:text-slate-300'}`}>
          <span>{label}</span>
          <span className="tabular-nums">{value}</span>
        </div>
      ))}
      <div className="flex justify-between font-semibold text-slate-900 dark:text-white mt-1 pt-1 border-t border-slate-200 dark:border-slate-700">
        <span>Customer pays</span>
        <span className="tabular-nums">{fmtR(total)}</span>
      </div>
    </div>
  )
}

function Chips({ values, value, onPick, format = (v) => `R${v}` }) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onPick(a)}
          aria-pressed={Number(value) === a}
          className={`px-3 py-1.5 rounded-full text-sm font-medium ring-1 ring-inset ${
            Number(value) === a ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 ring-slate-200 dark:ring-slate-700'
          }`}
        >
          {format(a)}
        </button>
      ))}
    </div>
  )
}

function ElectricityForm({ status }) {
  const qc = useQueryClient()
  const [meter, setMeter] = useState('')
  const [amount, setAmount] = useState('')
  const [cell, setCell] = useState('')
  const [check, setCheck] = useState(null)
  const fee = Number(status.electricity_fee) || 0
  const price = Number(amount) || 0
  const meterDigits = meter.replace(/\D/g, '')

  // Check the meter as soon as it looks complete: it tells the cashier whose
  // meter it is before any money changes hands.
  useEffect(() => {
    setCheck(null)
    if (meterDigits.length < 11) return undefined
    let cancelled = false
    const t = setTimeout(() => {
      AirtimeAPI.meter(meterDigits)
        .then((res) => !cancelled && setCheck(res))
        .catch(() => {})
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [meterDigits])

  const sell = useMutation({
    mutationFn: () => AirtimeAPI.sell({ kind: 'electricity', meter_number: meterDigits, amount: price, msisdn: cell }),
    onSuccess: (sale) => {
      const tokens = sale?.details?.tokens || []
      toast.success(
        tokens.length ? `Token: ${tokens.join(' / ')}. Collect ${fmtR(price + fee)}.` : `Bought. The token will appear under Recent sales in a moment. Collect ${fmtR(price + fee)}.`,
        { duration: 12000 },
      )
      setMeter('')
      setAmount('')
      setCell('')
      qc.invalidateQueries({ queryKey: ['airtime'] })
    },
    onError: (e) => toast.error(apiError(e), { duration: 8000 }),
  })

  const lim = status.limits
  const validAmount = Number.isInteger(price) && price >= lim.electricity_min && price <= lim.electricity_max
  const validCell = cell.replace(/\D/g, '').length >= 10
  const enough = status.balance == null || status.balance >= price
  const unsupported = check?.status === 'unsupported' || check?.supported === false
  const theirFee = electricityFee(price)

  return (
    <>
      <Input
        label="Meter number"
        inputMode="numeric"
        placeholder="11 digits, printed on the meter"
        value={meter}
        onChange={(e) => setMeter(e.target.value)}
        error={unsupported ? 'This meter cannot be bought for here.' : undefined}
        hint={
          check?.provider
            ? `Meter found: ${check.provider}`
            : check?.status === 'unknown'
              ? 'Could not check this meter right now. You can still try the sale.'
              : 'The meter is checked before you sell.'
        }
      />
      <div>
        <Chips values={ELECTRICITY_QUICK} value={amount} onPick={(a) => setAmount(String(a))} />
        <div className="max-w-[12rem] mt-2">
          <Input label="Amount (R)" type="number" min={lim.electricity_min} max={lim.electricity_max} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} hint={`R${lim.electricity_min} to R${lim.electricity_max}, whole rands`} />
        </div>
      </div>
      <Input label="Customer's cell number (the token is also sent by SMS)" type="tel" inputMode="tel" placeholder="082 123 4567" value={cell} onChange={(e) => setCell(e.target.value)} />
      <Summary
        rows={[
          ['Electricity purchase', fmtR(price)],
          [`Electricity the customer receives (supplier keeps ${fmtR(theirFee)})`, fmtR(Math.max(0, price - theirFee)), true],
          ['Your service fee', fmtR(fee)],
        ]}
        total={price + fee}
      />
      {!enough && <p className="text-sm text-red-600 dark:text-red-400">Your wallet has {fmtR(status.balance)}. Load money before selling this.</p>}
      <Button size="lg" disabled={meterDigits.length < 8 || unsupported || !validAmount || !validCell || !enough || sell.isPending} onClick={() => sell.mutate()}>
        <Zap size={16} /> {sell.isPending ? 'Buying…' : `Buy ${fmtR(price)} electricity`}
      </Button>
    </>
  )
}

function VoucherForm({ status }) {
  const qc = useQueryClient()
  const list = useQuery({ queryKey: ['airtime', 'vouchers'], queryFn: AirtimeAPI.vouchers, staleTime: 10 * 60_000 })
  const [productId, setProductId] = useState(null)
  const [amount, setAmount] = useState('')
  const fee = Number(status.service_fee) || 0
  const items = list.data?.items || []
  const product = items.find((p) => p.product_id === productId)
  const price = Number(amount) || 0

  const sell = useMutation({
    mutationFn: () => AirtimeAPI.sell({ kind: 'voucher', product_id: productId, amount: price }),
    onSuccess: () => {
      toast.success(`Voucher bought. The code appears under Recent sales. Collect ${fmtR(price + fee)}.`, { duration: 10000 })
      setAmount('')
      qc.invalidateQueries({ queryKey: ['airtime'] })
    },
    onError: (e) => toast.error(apiError(e), { duration: 8000 }),
  })
  const enough = status.balance == null || status.balance >= price

  if (list.isLoading) return <Skeleton className="h-40 rounded-2xl" />
  if (list.isError) return <p className="text-sm text-red-600 dark:text-red-400">{apiError(list.error)}</p>

  return (
    <>
      <div>
        <p className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Shop</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2" role="radiogroup" aria-label="Voucher brand">
          {items.map((p) => (
            <button
              key={p.product_id}
              type="button"
              role="radio"
              aria-checked={productId === p.product_id}
              onClick={() => { setProductId(p.product_id); setAmount('') }}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl p-3 h-24 ring-2 ring-inset transition-all bg-white ${
                productId === p.product_id ? 'ring-brand-600' : 'ring-slate-200 dark:ring-slate-700 hover:ring-slate-300'
              }`}
            >
              {p.logo_url ? <img src={p.logo_url} alt="" className="max-h-10 max-w-full object-contain" /> : null}
              <span className="text-xs font-semibold text-slate-900">{p.name}</span>
            </button>
          ))}
        </div>
      </div>
      {product && (
        <div>
          <p className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">{product.name} voucher value</p>
          <div className="max-h-40 overflow-y-auto pr-1">
            <Chips values={product.amounts} value={amount} onPick={(a) => setAmount(String(a))} />
          </div>
        </div>
      )}
      <Summary rows={[[product ? `${product.name} voucher` : 'Voucher', fmtR(price)], ['Your service fee', fmtR(fee)]]} total={price + fee} />
      {!enough && <p className="text-sm text-red-600 dark:text-red-400">Your wallet has {fmtR(status.balance)}. Load money before selling this.</p>}
      <Button size="lg" disabled={!product || !price || !enough || sell.isPending} onClick={() => sell.mutate()}>
        <Gift size={16} /> {sell.isPending ? 'Buying…' : `Buy ${fmtR(price)} voucher`}
      </Button>
    </>
  )
}

// What the customer takes away from an electricity or voucher sale, with a
// way to copy it or print it on a slip.
function SaleCodes({ sale }) {
  const tokens = sale.details?.tokens || []
  const vouchers = sale.details?.vouchers || []
  const lines = [
    ...tokens.map((t) => ({ label: 'Token', code: t.replace(/(\d{4})(?=\d)/g, '$1 ') })),
    ...vouchers.map((v) => ({ label: v.voucher_type || 'Code', code: String(v.voucher_code || ''), extra: v.expiry_date ? `valid until ${v.expiry_date}` : '' })),
  ].filter((l) => l.code)
  if (!lines.length) {
    return ['electricity', 'voucher'].includes(sale.kind) && sale.status !== 'failed' ? (
      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Waiting for the {sale.kind === 'electricity' ? 'token' : 'code'}…</p>
    ) : null
  }
  const text = lines.map((l) => `${l.label}: ${l.code}${l.extra ? ` (${l.extra})` : ''}`).join('\n')
  const print = () => {
    const w = window.open('', '_blank', 'width=320,height=480')
    if (!w) return toast.error('Allow pop-ups to print the slip.')
    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
    w.document.write(
      `<html><head><title>Slip</title><style>body{font-family:monospace;font-size:13px;width:72mm;margin:0;padding:4mm}h3{margin:0 0 6px}b{font-size:16px}</style></head><body><h3>${esc(sale.description || sale.kind)}</h3>${
        sale.details?.meter_number ? `<div>Meter: ${esc(sale.details.meter_number)}</div>` : ''
      }${lines.map((l) => `<div style="margin-top:8px">${esc(l.label)}:<br><b>${esc(l.code)}</b>${l.extra ? `<br>${esc(l.extra)}` : ''}</div>`).join('')}<div style="margin-top:10px">${esc(fmtTime(sale.created_at))}</div></body></html>`,
    )
    w.document.close()
    w.focus()
    w.print()
  }
  return (
    <div className="mt-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
      {lines.map((l) => (
        <p key={l.code} className="font-mono text-sm font-semibold text-slate-900 dark:text-white break-all">
          <span className="font-sans font-normal text-xs text-slate-500 dark:text-slate-400">{l.label}: </span>
          {l.code}
          {l.extra && <span className="font-sans font-normal text-xs text-slate-500 dark:text-slate-400"> · {l.extra}</span>}
        </p>
      ))}
      <div className="mt-1 flex gap-3 text-xs">
        <button type="button" className="text-brand-600 dark:text-brand-400 hover:underline" onClick={() => navigator.clipboard?.writeText(text).then(() => toast.success('Copied'), () => toast.error('Could not copy'))}>
          Copy
        </button>
        <button type="button" className="text-brand-600 dark:text-brand-400 hover:underline" onClick={print}>
          Print slip
        </button>
      </div>
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
  const [detected, setDetected] = useState(null)
  const fee = Number(status.service_fee) || 0

  // Once a full number is typed, ask which network it is on (ported numbers
  // included) and select it. The cashier can still change it by hand.
  const digits = msisdn.replace(/\D/g, '')
  useEffect(() => {
    setDetected(null)
    if (digits.length < 10) return undefined
    let cancelled = false
    const t = setTimeout(() => {
      AirtimeAPI.network(digits)
        .then((res) => {
          if (cancelled || !res?.network) return
          setDetected(res.network)
          setNetwork(res.network)
          setBundle('')
        })
        .catch(() => {})
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [digits])

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
        <CardDescription>Take the customer's money first. What you sell is paid from your wallet straight away.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="What to sell">
          {[
            ['airtime', 'Airtime', Smartphone],
            ['data', 'Data bundle', Wifi],
            ['electricity', 'Electricity', Zap],
            ['voucher', 'Vouchers', Gift],
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

        {kind === 'electricity' && <ElectricityForm status={status} />}
        {kind === 'voucher' && <VoucherForm status={status} />}
        {(kind === 'airtime' || kind === 'data') && (<>
        <Input
          label="Customer's cell number"
          type="tel"
          inputMode="tel"
          placeholder="082 123 4567"
          value={msisdn}
          onChange={(e) => setMsisdn(e.target.value)}
          hint={detected ? `This number is on ${networkOf(detected)?.label}. Selected for you.` : 'Type the number and the network is picked for you.'}
        />

        <div>
          <p className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Network</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Network">
            {NETWORKS.map((n) => (
              <button
                key={n.key}
                type="button"
                role="radio"
                aria-checked={network === n.key}
                onClick={() => { setNetwork(n.key); setBundle('') }}
                className={`flex items-center gap-2.5 rounded-2xl p-2.5 text-left ring-2 ring-inset transition-all ${
                  network === n.key
                    ? 'ring-brand-600 bg-brand-50 dark:bg-brand-950/40'
                    : 'ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-900 hover:ring-slate-300'
                }`}
              >
                <NetworkMark network={n.key} />
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{n.label}</span>
              </button>
            ))}
          </div>
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
          <BundlePicker network={network} items={items} loading={bundles.isLoading} value={bundle} onChange={setBundle} />
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
        </>)}
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
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Airtime, electricity & vouchers</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Airtime and data for every network, prepaid electricity and shopping vouchers, all from your own wallet.</p>
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
                      <NetworkMark network={x.network} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {x.description || `${x.kind} ${fmtR(x.amount)}`}
                          {x.msisdn && !['electricity'].includes(x.kind) ? ` · ${x.msisdn}` : ''}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {fmtTime(x.created_at)} · fee {fmtR(x.service_fee)}
                        </p>
                        <SaleCodes sale={x} />
                      </div>
                      <Badge tone={STATUS_TONE[x.status] || 'neutral'} size="sm" dot>{x.status}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <CardContent className="text-sm text-slate-500 dark:text-slate-400">Nothing sold yet.</CardContent>
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
                  <div className="space-y-4">
                    <FeeSetting key={`a${s.service_fee}`} field="service_fee" label="Airtime, data and vouchers (R)" fee={s.service_fee} max={s.limits.max_service_fee} />
                    <FeeSetting key={`e${s.electricity_fee}`} field="electricity_fee" label="Electricity (R)" fee={s.electricity_fee} max={s.limits.max_service_fee} />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Added to every sale and kept in your till. This is your profit: what you sell costs you its full price.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
            {isAdmin && <SwitchOff status={s} />}
          </div>
        </div>
      )}
    </div>
  )
}
