import { money } from '../lib/receipt'

// The slip itself: on screen after a sale, on paper (80 mm thermal or A4 via
// the print dialog; index.css prints only [data-print-area]), and as the
// preview under Profile -> Receipt & business details.

function Divider() {
  return <div className="my-3 border-t border-dashed border-slate-300 dark:border-slate-600" />
}

function Line({ label, value, muted = false, strong = false, className = '' }) {
  return (
    <div
      className={`flex justify-between gap-3 ${muted ? 'text-slate-500 dark:text-slate-400' : ''} ${
        strong ? 'font-semibold' : ''
      } ${className}`}
    >
      <span>{label}</span>
      <span className="tabular-nums whitespace-nowrap">{value}</span>
    </div>
  )
}

export default function ReceiptSlip({ receipt, className = '' }) {
  if (!receipt) return null
  const { store, payment } = receipt
  const contact = [store.phone, store.email].filter(Boolean).join(' · ')

  return (
    <div
      data-print-area
      className={`receipt-slip bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-4 text-[13px] leading-snug ${className}`}
    >
      <div className="text-center">
        {store.logo_url && (
          <img
            src={store.logo_url}
            alt=""
            className="mx-auto mb-2 max-h-16 max-w-[160px] object-contain"
          />
        )}
        <div className="text-base font-bold uppercase tracking-wide">{store.name}</div>
        {store.address && (
          <div className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-line">{store.address}</div>
        )}
        {contact && <div className="text-xs text-slate-600 dark:text-slate-400">{contact}</div>}
        {store.website && <div className="text-xs text-slate-600 dark:text-slate-400">{store.website}</div>}
        {store.vat_number && <div className="text-xs mt-1">VAT No: {store.vat_number}</div>}
        {store.registration_number && <div className="text-xs">Reg No: {store.registration_number}</div>}
      </div>

      <Divider />

      <div className="text-center">
        <div className="text-xs font-bold tracking-[0.25em]">{receipt.title}</div>
        <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
          {receipt.number && <>No. {receipt.number} · </>}
          {receipt.dateLabel}
        </div>
        {receipt.cashier && <div className="text-xs text-slate-600 dark:text-slate-400">Served by {receipt.cashier}</div>}
        {receipt.customer?.name && (
          <div className="text-xs text-slate-600 dark:text-slate-400">Customer: {receipt.customer.name}</div>
        )}
        {receipt.offline && (
          <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">Saved offline. Will sync when online.</div>
        )}
      </div>

      <Divider />

      <div className="space-y-2">
        {receipt.items.map((it, idx) => (
          <div key={idx} className="flex justify-between gap-3">
            <div className="min-w-0">
              <div className="break-words">{it.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {it.quantity} × {money(it.unit_price)}
              </div>
            </div>
            <div className="tabular-nums whitespace-nowrap font-medium">{money(it.total)}</div>
          </div>
        ))}
      </div>

      <Divider />

      <div className="space-y-1">
        {receipt.discount > 0 && (
          <>
            <Line label="Subtotal" value={money(receipt.subtotal)} muted />
            <Line label="Discount" value={`-${money(receipt.discount)}`} muted />
          </>
        )}
        <div className="flex justify-between items-baseline gap-3">
          <span className="font-bold">TOTAL</span>
          <span className="text-xl font-bold tabular-nums whitespace-nowrap">{money(receipt.total)}</span>
        </div>
        {receipt.vat && (
          <>
            <Line label={`Includes VAT @ ${receipt.vat.rate}%`} value={money(receipt.vat.amount)} muted />
            <Line label="Excluding VAT" value={money(receipt.vat.excluding)} muted />
          </>
        )}
        {payment.method === 'card' ? (
          <Line label="Paid by" value="Card" muted />
        ) : (
          <>
            <Line label="Cash tendered" value={money(payment.tendered)} muted />
            <Line
              label="Change"
              value={money(payment.change)}
              strong
              className="text-emerald-700 dark:text-emerald-400 text-base"
            />
          </>
        )}
      </div>

      <Divider />

      <div className="text-center text-xs">
        <div className="font-medium">{store.receipt_footer || 'Thank you for your support!'}</div>
        <div className="text-slate-400 dark:text-slate-500 mt-1">Powered by KashPoint · kashpoint.co.za</div>
      </div>
    </div>
  )
}
