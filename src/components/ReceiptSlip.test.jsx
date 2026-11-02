import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReceiptSlip from './ReceiptSlip'
import { buildReceipt } from '../lib/receipt'

const store = {
  name: 'Kj General Fashion',
  logo_url: 'https://cdn.example.com/kj.png',
  address: '12 Market St, Mayfair',
  phone: '+27821234567',
  vat_number: '4123456789',
  receipt_footer: 'No returns without this slip.',
}

describe('ReceiptSlip', () => {
  it('shows the business, the VAT breakdown and the footer', () => {
    const receipt = buildReceipt({
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
    const { container } = render(<ReceiptSlip receipt={receipt} />)

    expect(container.querySelector('[data-print-area]')).not.toBeNull()
    expect(container.querySelector('img').getAttribute('src')).toBe(store.logo_url)
    expect(screen.getByText('Kj General Fashion')).toBeInTheDocument()
    expect(screen.getByText('12 Market St, Mayfair')).toBeInTheDocument()
    expect(screen.getByText('VAT No: 4123456789')).toBeInTheDocument()
    expect(screen.getByText('TAX INVOICE')).toBeInTheDocument()
    expect(screen.getByText(/No\. 131/)).toBeInTheDocument()
    expect(screen.getByText('Served by Thabo')).toBeInTheDocument()
    expect(screen.getByText('Customer: Naledi')).toBeInTheDocument()
    expect(screen.getByText('2 × R 450.00')).toBeInTheDocument()
    expect(screen.getByText('Includes VAT @ 15%')).toBeInTheDocument()
    expect(screen.getByText('R 117.39')).toBeInTheDocument()
    expect(screen.getByText('R 100.00')).toBeInTheDocument()
    expect(screen.getByText('No returns without this slip.')).toBeInTheDocument()
  })

  it('is a plain receipt without a VAT number', () => {
    const receipt = buildReceipt({ store: { name: 'Spaza' }, items: [{ name: 'Bread', quantity: 1, price: 18 }], paymentMethod: 'card' })
    render(<ReceiptSlip receipt={receipt} />)
    expect(screen.getByText('RECEIPT')).toBeInTheDocument()
    expect(screen.queryByText(/Includes VAT/)).toBeNull()
    expect(screen.getByText('Card')).toBeInTheDocument()
    expect(screen.getByText('Thank you for your support!')).toBeInTheDocument()
  })
})
