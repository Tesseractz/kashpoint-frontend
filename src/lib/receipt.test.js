import { describe, it, expect } from 'vitest'
import { buildReceipt, money, receiptText, vatBreakdown, whatsappUrl } from './receipt'

const store = {
  name: 'Kj General Fashion',
  address: '12 Market St, Mayfair',
  phone: '+27821234567',
  email: 'kj@example.com',
  vat_number: '4123456789',
  receipt_footer: 'No returns without this slip.',
}
const items = [
  { name: "Levi's Jeans", quantity: 2, price: 450, subtotal: 900 },
  { name: 'T-shirt', quantity: 1, price: 120, subtotal: 120 },
]

describe('money', () => {
  it('formats rands with thousands spaces', () => {
    expect(money(10000)).toBe('R 10 000.00')
    expect(money(1234567.891)).toBe('R 1 234 567.89')
    expect(money(0.5)).toBe('R 0.50')
    expect(money(-5)).toBe('-R 5.00')
  })
})

describe('vatBreakdown', () => {
  it('finds the 15% inside a VAT-inclusive price', () => {
    expect(vatBreakdown(115)).toEqual({ rate: 15, amount: 15, excluding: 100 })
    expect(vatBreakdown(1020).amount).toBe(133.04)
  })
})

describe('buildReceipt', () => {
  it('makes a tax invoice for a VAT-registered shop', () => {
    const r = buildReceipt({ store, items, total: 1020, paymentMethod: 'cash', paymentAmount: 1100, change: 80, number: 131, cashier: 'Thabo' })
    expect(r.title).toBe('TAX INVOICE')
    expect(r.vat).toEqual({ rate: 15, amount: 133.04, excluding: 886.96 })
    expect(r.items[0]).toEqual({ name: "Levi's Jeans", quantity: 2, unit_price: 450, total: 900 })
    expect(r.payment).toEqual({ method: 'cash', tendered: 1100, change: 80 })
    expect(r.cashier).toBe('Thabo')
  })

  it('is a plain receipt without a VAT number and never prints an email as the cashier', () => {
    const r = buildReceipt({ store: { name: 'Spaza' }, items, cashier: 'owner@example.com', paymentMethod: 'card' })
    expect(r.title).toBe('RECEIPT')
    expect(r.vat).toBeNull()
    expect(r.cashier).toBeNull()
    expect(r.total).toBe(1020)
    expect(r.payment).toEqual({ method: 'card', tendered: 1020, change: 0 })
  })

  it('works out change when not given', () => {
    const r = buildReceipt({ store, items, paymentMethod: 'cash', paymentAmount: 1050 })
    expect(r.payment.change).toBe(30)
  })

  it('copes with no store at all', () => {
    const r = buildReceipt({ items: [] })
    expect(r.store.name).toBe('Your Store')
    expect(r.total).toBe(0)
  })
})

describe('receiptText', () => {
  it('reads as a complete WhatsApp receipt', () => {
    const text = receiptText(buildReceipt({ store, items, total: 1020, paymentAmount: 1100, change: 80, number: 131, customer: { name: 'Naledi' } }))
    expect(text).toContain('*Kj General Fashion*')
    expect(text).toContain('12 Market St, Mayfair')
    expect(text).toContain('VAT No: 4123456789')
    expect(text).toContain('*TAX INVOICE #131*')
    expect(text).toContain('Customer: Naledi')
    expect(text).toContain("2 × Levi's Jeans — R 900.00")
    expect(text).toContain('*TOTAL: R 1 020.00*')
    expect(text).toContain('Includes VAT @ 15%: R 133.04')
    expect(text).toContain('Paid cash R 1 100.00 · change R 80.00')
    expect(text).toContain('No returns without this slip.')
  })
})

describe('whatsappUrl', () => {
  it("opens the customer's chat when their number is known", () => {
    expect(whatsappUrl('hi there', '083 111 2222')).toBe('https://wa.me/27831112222?text=hi%20there')
  })

  it('lets the cashier pick the chat otherwise', () => {
    expect(whatsappUrl('hi', null)).toBe('https://wa.me/?text=hi')
    expect(whatsappUrl('hi', '12')).toBe('https://wa.me/?text=hi')
  })
})
