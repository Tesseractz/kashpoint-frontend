// The receipt as one self-contained HTML document for a till-roll printer.
//
// ReceiptSlip.jsx draws the same slip on screen; this version carries its own
// styles, sized to a 58 mm or 80 mm roll, so the desktop app can print it in
// a hidden window without the browser's print dialog. Everything that came
// from a person (store name, item names, footer) is escaped: a product called
// "<b>Bread</b>" prints as typed.
import { money } from './receipt'

export const PAPER_WIDTHS = [80, 58]

// Printable width inside the roll. Thermal heads leave a few millimetres on
// each side, so the body sits inside that rather than at the paper's edge.
const INNER_MM = { 80: 72, 58: 48 }

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c])

const safeImageUrl = (url) => (typeof url === 'string' && /^https?:\/\//i.test(url) ? url : '')

const row = (label, value, cls = '') =>
  `<div class="row ${cls}"><span>${esc(label)}</span><span class="num">${esc(value)}</span></div>`

export function receiptHtml(r, { paperWidth = 80 } = {}) {
  const paper = PAPER_WIDTHS.includes(Number(paperWidth)) ? Number(paperWidth) : 80
  const inner = INNER_MM[paper]
  const side = (paper - inner) / 2
  const font = paper === 58 ? 11 : 12
  const s = r.store || {}
  const contact = [s.phone, s.email].filter(Boolean).join(' · ')
  const logo = safeImageUrl(s.logo_url)

  const head = [
    logo ? `<img class="logo" src="${esc(logo)}" alt="">` : '',
    `<div class="name">${esc(s.name || 'Your Store')}</div>`,
    s.address ? `<div class="muted pre">${esc(s.address)}</div>` : '',
    contact ? `<div class="muted">${esc(contact)}</div>` : '',
    s.website ? `<div class="muted">${esc(s.website)}</div>` : '',
    s.vat_number ? `<div>VAT No: ${esc(s.vat_number)}</div>` : '',
    s.registration_number ? `<div>Reg No: ${esc(s.registration_number)}</div>` : '',
  ].join('')

  const meta = [
    `<div class="title">${esc(r.title)}</div>`,
    `<div class="muted">${r.number ? `No. ${esc(r.number)} · ` : ''}${esc(r.dateLabel)}</div>`,
    r.cashier ? `<div class="muted">Served by ${esc(r.cashier)}</div>` : '',
    r.customer?.name ? `<div class="muted">Customer: ${esc(r.customer.name)}</div>` : '',
    r.offline ? `<div class="muted">Saved offline. Will sync when online.</div>` : '',
  ].join('')

  const items = (r.items || [])
    .map(
      (it) =>
        `<div class="item"><div class="desc"><div>${esc(it.name)}</div><div class="muted">${esc(it.quantity)} × ${esc(money(it.unit_price))}</div></div><div class="num">${esc(money(it.total))}</div></div>`
    )
    .join('')

  const totals = [
    r.discount > 0 ? row('Subtotal', money(r.subtotal), 'muted') : '',
    r.discount > 0 ? row('Discount', `-${money(r.discount)}`, 'muted') : '',
    `<div class="row total"><span>TOTAL</span><span class="num">${esc(money(r.total))}</span></div>`,
    r.vat ? row(`Includes VAT @ ${r.vat.rate}%`, money(r.vat.amount), 'muted') : '',
    r.vat ? row('Excluding VAT', money(r.vat.excluding), 'muted') : '',
    r.payment?.method === 'card'
      ? row('Paid by', 'Card', 'muted')
      : row('Cash tendered', money(r.payment?.tendered), 'muted') + row('Change', money(r.payment?.change), 'change'),
  ].join('')

  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title><style>
@page{margin:0}
html,body{margin:0;padding:0;background:#fff;color:#000}
body{width:${paper}mm;box-sizing:border-box;padding:2mm ${side}mm 4mm;font:${font}px/1.35 Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact}
.c{text-align:center}
.logo{display:block;margin:0 auto 2mm;max-height:18mm;max-width:40mm;object-fit:contain;filter:grayscale(1)}
.name{font-weight:700;font-size:${font + 3}px;text-transform:uppercase;letter-spacing:.04em}
.muted{font-size:${font - 1}px}
.pre{white-space:pre-line}
.title{font-weight:700;font-size:${font - 1}px;letter-spacing:.25em}
hr{border:0;border-top:1px dashed #000;margin:2.5mm 0}
.row,.item{display:flex;justify-content:space-between;gap:3mm;margin:1mm 0}
.desc{min-width:0;word-break:break-word}
.num{white-space:nowrap;font-variant-numeric:tabular-nums}
.item .num{font-weight:600}
.total{font-weight:700;font-size:${font + 5}px;align-items:baseline;margin-top:1.5mm}
.change{font-weight:700;font-size:${font + 2}px}
.foot{margin-top:1mm}
.powered{font-size:${font - 2}px;margin-top:1mm}
</style></head><body>
<div class="c">${head}</div><hr>
<div class="c">${meta}</div><hr>
<div>${items}</div><hr>
<div>${totals}</div><hr>
<div class="c foot">${esc(s.receipt_footer || 'Thank you for your support!')}</div>
<div class="c powered">Powered by KashPoint · kashpoint.co.za</div>
</body></html>`
}
