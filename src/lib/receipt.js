// The receipt as the app shows, prints and shares it. The backend builds the
// emailed version from the same facts (app/services/receipts.py), so every
// copy of a receipt says the same thing.
import { normalizePhone } from './phone'

export const VAT_RATE = 0.15 // South Africa

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

/** "R 10 000.00": a space every three digits, always two decimals. */
export function money(value) {
  const n = round2(value)
  const sign = n < 0 ? '-' : ''
  const [whole, frac] = Math.abs(n).toFixed(2).split('.')
  return `${sign}R ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${frac}`
}

/** The 15% VAT already inside a price. */
export function vatBreakdown(total) {
  const amount = round2((Number(total) || 0) * VAT_RATE / (1 + VAT_RATE))
  return { rate: Math.round(VAT_RATE * 100), amount, excluding: round2(total - amount) }
}

/** "02 Nov 2026, 19:58" */
export function formatReceiptDate(value) {
  const d = value ? new Date(value) : new Date()
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// An owner's profile name is their email address, which is not a name to
// print for a customer.
export function isDisplayName(name) {
  return typeof name === 'string' && name.trim().length > 0 && !name.includes('@')
}

/**
 * Normalise what the till knows into one receipt object.
 * items: [{ name, quantity, price | unit_price, subtotal | total }]
 */
export function buildReceipt({
  store,
  items = [],
  total,
  paymentMethod = 'cash',
  paymentAmount,
  change,
  number = '',
  customer = null,
  cashier = null,
  date,
  offline = false,
  discount = 0,
} = {}) {
  const s = { ...(store || {}) }
  if (!s.name) s.name = 'Your Store'

  const lines = items.map((i) => {
    const quantity = Number(i.quantity) || 1
    const lineTotal = round2(
      i.total ?? i.subtotal ?? (Number(i.price ?? i.unit_price) || 0) * quantity,
    )
    const unit = round2(i.unit_price ?? i.price ?? lineTotal / quantity)
    return { name: i.name, quantity, unit_price: unit, total: lineTotal }
  })
  const sum = round2(total ?? lines.reduce((a, l) => a + l.total, 0))
  const disc = round2(discount || 0)
  const vat = s.vat_number ? vatBreakdown(sum) : null
  const method = String(paymentMethod || 'cash').toLowerCase()
  const tendered = method === 'cash' ? round2(paymentAmount ?? sum) : sum
  const changeDue = method === 'cash' ? round2(change ?? Math.max(0, tendered - sum)) : 0

  return {
    number: number ? String(number) : '',
    title: vat ? 'TAX INVOICE' : 'RECEIPT',
    store: s,
    dateLabel: formatReceiptDate(date),
    cashier: isDisplayName(cashier) ? cashier.trim() : null,
    customer: customer && (customer.name || customer.phone || customer.email) ? customer : null,
    items: lines,
    subtotal: round2(sum + disc),
    discount: disc,
    total: sum,
    vat,
    payment: { method, tendered, change: changeDue },
    offline: !!offline,
  }
}

/** The receipt as a WhatsApp message (WhatsApp renders *bold*). */
export function receiptText(r) {
  const s = r.store
  const head = [`*${s.name}*`]
  if (s.address) head.push(s.address)
  const contact = [s.phone, s.email].filter(Boolean).join(' · ')
  if (contact) head.push(contact)
  if (s.vat_number) head.push(`VAT No: ${s.vat_number}`)

  const lines = [
    ...head,
    '',
    `*${r.title}${r.number ? ` #${r.number}` : ''}*`,
    r.dateLabel,
  ]
  if (r.cashier) lines.push(`Served by ${r.cashier}`)
  if (r.customer?.name) lines.push(`Customer: ${r.customer.name}`)
  lines.push('')
  for (const it of r.items) {
    lines.push(`${it.quantity} × ${it.name} — ${money(it.total)}`)
  }
  lines.push('')
  if (r.discount > 0) {
    lines.push(`Subtotal: ${money(r.subtotal)}`)
    lines.push(`Discount: -${money(r.discount)}`)
  }
  lines.push(`*TOTAL: ${money(r.total)}*`)
  if (r.vat) lines.push(`Includes VAT @ ${r.vat.rate}%: ${money(r.vat.amount)}`)
  if (r.payment.method === 'card') {
    lines.push('Paid by card')
  } else {
    lines.push(`Paid cash ${money(r.payment.tendered)} · change ${money(r.payment.change)}`)
  }
  lines.push('')
  lines.push(s.receipt_footer || 'Thank you for your support! 🙏')
  lines.push('_Powered by KashPoint · kashpoint.co.za_')
  return lines.join('\n')
}

/** wa.me link; opens the customer's chat directly when their number is known. */
export function whatsappUrl(text, phone) {
  const e164 = normalizePhone(phone)
  const base = e164 ? `https://wa.me/${e164.slice(1)}` : 'https://wa.me/'
  return `${base}?text=${encodeURIComponent(text)}`
}
