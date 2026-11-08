import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom'

const { stores } = vi.hoisted(() => ({ stores: vi.fn() }))
vi.mock('../../api/client', () => ({ AdminAPI: { stores } }))

import AdminStores from './AdminStores'

const ITEMS = [
  {
    id: 's1',
    name: 'Trial Shop',
    owner_email: 'one@example.com',
    phone: '+27820000001',
    created_at: '2026-11-03T10:00:00Z',
    partner: { id: 'pt1', name: 'TechZone', code: 'TECHZONE' },
    subscription: { state: 'trial', label: 'On trial', days_left: 12, card_on_file: false },
    users_count: 1,
    products_count: 0,
    sales_30d_count: 0,
    sales_30d_total: 0,
    last_sale_at: null,
    last_sign_in_at: null,
  },
  {
    id: 's2',
    name: 'Paying Shop',
    owner_email: 'two@example.com',
    phone: null,
    created_at: '2026-09-09T10:00:00Z',
    partner: null,
    subscription: { state: 'active', label: 'Paying', paid_through: '2026-11-28T00:00:00Z', card_on_file: true, paying: true },
    users_count: 2,
    products_count: 2,
    sales_30d_count: 2,
    sales_30d_total: 200,
    last_sale_at: '2026-11-07T10:00:00Z',
    last_sign_in_at: '2026-11-07T09:00:00Z',
  },
]

function Shell({ isOwner }) {
  return <Outlet context={{ isOwner }} />
}

function renderPage(isOwner = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin/stores']}>
        <Routes>
          <Route element={<Shell isOwner={isOwner} />}>
            <Route path="/admin/stores" element={<AdminStores />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdminStores', () => {
  // Braces matter: a value returned from beforeEach is run as a cleanup hook,
  // and mockReset() returns the mock itself.
  beforeEach(() => {
    stores.mockReset()
  })

  it('lists every store with its state and owner', async () => {
    stores.mockResolvedValue({ items: ITEMS, total: 2, partners: [{ id: 'pt1', name: 'TechZone', code: 'TECHZONE' }] })
    renderPage()
    expect((await screen.findAllByText('Trial Shop')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('one@example.com').length).toBeGreaterThan(0)
    expect(screen.getAllByText('On trial').length).toBeGreaterThan(0)
    expect(screen.getAllByText('12 days left').length).toBeGreaterThan(0)
    expect(screen.getByText('2 stores')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Partner' })).toBeInTheDocument()
    expect(stores).toHaveBeenCalledWith({ q: '', state: '', partner_id: '' })
  })

  it('asks the API for the chosen status filter', async () => {
    stores.mockResolvedValue({ items: [], total: 0, partners: [] })
    renderPage()
    await screen.findByText('No stores yet')
    fireEvent.click(screen.getByRole('button', { name: 'Paying' }))
    await waitFor(() => expect(stores).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'active' })))
    expect(await screen.findByText('No stores match')).toBeInTheDocument()
  })

  it('hides the partner column and filter from partners', async () => {
    stores.mockResolvedValue({ items: ITEMS, total: 2, partners: [] })
    renderPage(false)
    await screen.findAllByText('Trial Shop')
    expect(screen.queryByRole('columnheader', { name: 'Partner' })).toBeNull()
    expect(screen.queryByLabelText('Filter by partner')).toBeNull()
  })

  it('shows the API error with a retry', async () => {
    // What axios rejects with: an Error carrying the response.
    const err = Object.assign(new Error('Request failed with status code 403'), {
      response: { status: 403, data: { detail: 'This account is not a KashPoint platform admin.' } },
    })
    stores.mockRejectedValue(err)
    renderPage()
    expect(await screen.findByText('This account is not a KashPoint platform admin.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
