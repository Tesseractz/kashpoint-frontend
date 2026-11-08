import { describe, it, expect } from 'vitest'
import { buildReceipt } from './receipt'
import { receiptHtml, esc } from './receiptHtml'

const store = {
  name: 'Kj General Fashion',
  logo_url: 'https://cdn.example.com/kj.png',
  address: '12 Market St\nMayfair',
  phone: '+27821234567',
  vat_number: '4123456789',
  receipt_footer: 'No returns without this slip.',
}

describe('receiptHtml', () => {
  it('is a complete document carrying the same facts as the slip', () => {
    const r = buildReceipt({
      store,
      items: [{ name: 'Jeans', quantity: 2, price: 450, subtotal: 900 }],
      total: 900,
      paymentMethod: 'cash',
      paymentAmount: 1000,
      change: 100,
      number: 131,
      cashier: 'Thabo',
      customer: { name: 'Naledi' },
    })
    const html = receiptHtml(r)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('width:80mm')
    expect(html).toContain('src="https://cdn.example.com/kj.png"')
    expect(html).toContain('Kj General Fashion')
    expect(html).toContain('VAT No: 4123456789')
    expect(html).toContain('TAX INVOICE')
    expect(html).toContain('No. 131')
    expect(html).toContain('Served by Thabo')
    expect(html).toContain('Customer: Naledi')
    expect(html).toContain('2 × R 450.00')
    expect(html).toContain('Includes VAT @ 15%')
    expect(html).toContain('R 117.39')
    expect(html).toContain('Cash tendered')
    expect(html).toContain('R 100.00')
    expect(html).toContain('No returns without this slip.')
    expect(html).toContain('Powered by KashPoint')
  })

  it('sizes itself for a 58 mm roll and a card payment', () => {
    const r = buildReceipt({ store: { name: 'Spaza' }, items: [{ name: 'Bread', quantity: 1, price: 18 }], paymentMethod: 'card' })
    const html = receiptHtml(r, { paperWidth: 58 })
    expect(html).toContain('width:58mm')
    expect(html).toContain('RECEIPT')
    expect(html).toContain('>Card<')
    expect(html).not.toContain('Includes VAT')
    expect(html).not.toContain('<img')
    expect(html).toContain('Thank you for your support!')
  })

  it('prints what people typed instead of interpreting it as HTML', () => {
    const r = buildReceipt({
      store: { name: '<b>Spaza</b>', receipt_footer: 'Tom & Jerry\'s "shop"', logo_url: 'javascript:alert(1)' },
      items: [{ name: '<img src=x onerror=alert(1)>', quantity: 1, price: 5 }],
    })
    const html = receiptHtml(r)
    expect(html).not.toContain('<b>Spaza</b>')
    expect(html).toContain('&lt;b&gt;Spaza&lt;/b&gt;')
    // No <img> at all: the product name is text and the logo URL was refused.
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain('Tom &amp; Jerry&#39;s &quot;shop&quot;')
    expect(html).not.toContain('javascript:')
    expect(esc(null)).toBe('')
  })

  it('falls back to 80 mm for an unknown width', () => {
    const r = buildReceipt({ store: { name: 'S' }, items: [] })
    expect(receiptHtml(r, { paperWidth: 100 })).toContain('width:80mm')
  })
})
