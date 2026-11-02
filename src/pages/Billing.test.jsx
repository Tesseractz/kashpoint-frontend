import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// vi.mock factories are hoisted above the imports below, so anything they
// reference must also be hoisted. vi.hoisted runs before the mock factories.
const { BillingAPIMock, PlanAPIMock, useAuthMock, openExternalUrlMock, toastFn, toastMock } =
  vi.hoisted(() => {
    const toastMock = { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() }
    return {
      BillingAPIMock: {
        config: vi.fn(),
        checkout: vi.fn(),
        cardSetup: vi.fn(),
        paystackSync: vi.fn(),
        cancel: vi.fn(),
      },
      PlanAPIMock: { get: vi.fn() },
      useAuthMock: vi.fn(),
      openExternalUrlMock: vi.fn(),
      toastFn: vi.fn(),
      toastMock,
    }
  })

vi.mock('../api/client', () => ({
  BillingAPI: BillingAPIMock,
  PlanAPI: PlanAPIMock,
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('../lib/platform', () => ({
  openExternalUrl: (...args) => openExternalUrlMock(...args),
}))

// react-hot-toast exports a default function with attached methods
vi.mock('react-hot-toast', () => ({
  default: Object.assign(toastFn, toastMock),
}))

import Billing from './Billing'

function renderBilling() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/billing']}>
        <Billing />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Billing — reference-based verification UX', () => {
  beforeEach(() => {
    Object.values(BillingAPIMock).forEach((m) => m.mockReset?.())
    PlanAPIMock.get.mockReset()
    useAuthMock.mockReturnValue({ user: { email: 'owner@example.com' } })
    openExternalUrlMock.mockReset()
    toastFn.mockReset()
    Object.values(toastMock).forEach((m) => m.mockReset?.())

    BillingAPIMock.config.mockResolvedValue({ provider: 'paystack' })
    PlanAPIMock.get.mockResolvedValue({
      plan: 'expired',
      status: 'expired',
      is_active: false,
      is_on_trial: false,
      limits: {},
      usage: {},
    })
  })

  afterEach(() => {
    delete window.Capacitor
  })

  it('verifies on the mobile path using the reference from /billing/checkout', async () => {
    // Simulate a Capacitor in-app browser flow.
    window.Capacitor = { isNativePlatform: () => true, Plugins: { Browser: {} } }

    BillingAPIMock.checkout.mockResolvedValue({
      url: 'https://checkout.paystack.com/abc',
      reference: 'ref-from-server',
    })
    openExternalUrlMock.mockResolvedValue({
      kind: 'in-app-browser',
      onClosed: Promise.resolve(),
    })
    BillingAPIMock.paystackSync.mockResolvedValue({ synced: true })

    renderBilling()
    // Initial /billing/config + /plan resolve
    await waitFor(() => expect(screen.getByText(/Current Plan:/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Subscribe — R150/ }))

    await waitFor(() => {
      expect(BillingAPIMock.checkout).toHaveBeenCalledWith({
        plan: 'pro',
        email: 'owner@example.com',
      })
    })

    await waitFor(() => {
      // paystackSync gets called with the exact reference returned by checkout.
      expect(BillingAPIMock.paystackSync).toHaveBeenCalledWith('ref-from-server')
    })

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith('Subscription activated!')
    })
  })

  it('shows the "we\'re still confirming" card when verify fails transiently — with a Check status button', async () => {
    window.Capacitor = { isNativePlatform: () => true, Plugins: { Browser: {} } }

    BillingAPIMock.checkout.mockResolvedValue({
      url: 'https://checkout.paystack.com/abc',
      reference: 'ref-uncertain',
    })
    openExternalUrlMock.mockResolvedValue({
      kind: 'in-app-browser',
      onClosed: Promise.resolve(),
    })
    // Simulate Paystack being unreachable — server error rather than abandoned.
    BillingAPIMock.paystackSync.mockRejectedValueOnce({
      response: { data: { detail: 'Paystack: connection reset' } },
    })

    renderBilling()
    await waitFor(() => expect(screen.getByText(/Current Plan:/i)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Subscribe — R150/ }))

    await waitFor(() =>
      expect(screen.getByText(/We're still confirming your payment/i)).toBeInTheDocument(),
    )
    expect(screen.getByText(/ref-uncertain/)).toBeInTheDocument()

    // Now retry succeeds — the Check status button should clear the card.
    BillingAPIMock.paystackSync.mockResolvedValueOnce({ synced: true })

    fireEvent.click(screen.getByRole('button', { name: /Check status/i }))

    await waitFor(() => {
      expect(BillingAPIMock.paystackSync).toHaveBeenCalledTimes(2)
      expect(BillingAPIMock.paystackSync).toHaveBeenLastCalledWith('ref-uncertain')
    })
    await waitFor(() =>
      expect(screen.queryByText(/We're still confirming your payment/i)).not.toBeInTheDocument(),
    )
    expect(toastMock.success).toHaveBeenCalledWith('Subscription activated!')
  })

  it('shows the "payment not completed" card when Paystack reports the transaction abandoned', async () => {
    window.Capacitor = { isNativePlatform: () => true, Plugins: { Browser: {} } }

    BillingAPIMock.checkout.mockResolvedValue({
      url: 'https://checkout.paystack.com/abc',
      reference: 'ref-abandoned',
    })
    openExternalUrlMock.mockResolvedValue({
      kind: 'in-app-browser',
      onClosed: Promise.resolve(),
    })
    BillingAPIMock.paystackSync.mockRejectedValue({
      response: { data: { detail: 'Transaction is not successful' } },
    })

    renderBilling()
    await waitFor(() => expect(screen.getByText(/Current Plan:/i)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Subscribe — R150/ }))

    await waitFor(() =>
      expect(screen.getByText(/Payment was not completed/i)).toBeInTheDocument(),
    )
    // "Try again" CTA + "Dismiss" — does NOT show a "Check status" button
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Check status/i })).not.toBeInTheDocument()
  })

  it('falls back to short polling when checkout returns no reference (older backend)', async () => {
    window.Capacitor = { isNativePlatform: () => true, Plugins: { Browser: {} } }

    BillingAPIMock.checkout.mockResolvedValue({
      url: 'https://checkout.paystack.com/abc',
      // Old-shape response — no reference.
    })
    openExternalUrlMock.mockResolvedValue({
      kind: 'in-app-browser',
      onClosed: Promise.resolve(),
    })
    // First two plan refetches still show inactive; third returns active.
    PlanAPIMock.get
      .mockResolvedValueOnce({ plan: 'expired', status: 'expired', is_active: false, limits: {}, usage: {} })
      .mockResolvedValueOnce({ plan: 'expired', status: 'expired', is_active: false, limits: {}, usage: {} })
      .mockResolvedValueOnce({ plan: 'expired', status: 'expired', is_active: false, limits: {}, usage: {} })
      .mockResolvedValueOnce({ plan: 'pro', status: 'active', is_active: true, limits: {}, usage: {} })

    renderBilling()
    await waitFor(() => expect(screen.getByText(/Current Plan:/i)).toBeInTheDocument())

    vi.useFakeTimers({ shouldAdvanceTime: true })
    fireEvent.click(screen.getByRole('button', { name: /Subscribe — R150/ }))

    // Advance through the 2.5s × 8 polling window.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8 * 2500)
    })
    vi.useRealTimers()

    await waitFor(() => {
      expect(BillingAPIMock.paystackSync).not.toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith('Subscription activated!')
    })
  })
})

describe('Billing — store on its free trial', () => {
  beforeEach(() => {
    Object.values(BillingAPIMock).forEach((m) => m.mockReset?.())
    PlanAPIMock.get.mockReset()
    useAuthMock.mockReturnValue({ user: { email: 'owner@example.com' } })
    openExternalUrlMock.mockReset()
    toastFn.mockReset()
    Object.values(toastMock).forEach((m) => m.mockReset?.())

    BillingAPIMock.config.mockResolvedValue({ provider: 'paystack' })
    PlanAPIMock.get.mockResolvedValue({
      plan: 'pro',
      status: 'trialing',
      is_active: true,
      is_on_trial: true,
      trial_end: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
      limits: {},
      usage: {},
    })
  })

  it('offers to save a card for later instead of charging now, with no cancel button', async () => {
    // A trial store is "pro" and "active" — the old guard treated that as
    // already subscribed and refused to open checkout.
    BillingAPIMock.cardSetup.mockResolvedValue({
      url: 'https://checkout.paystack.com/card',
      reference: 'ref-card',
    })
    openExternalUrlMock.mockResolvedValue({ kind: 'external' })

    renderBilling()
    await waitFor(() => expect(screen.getByText(/Trial: \d+ days left/i)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Cancel Subscription/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Subscribe — R150/ })).not.toBeInTheDocument()
    expect(screen.getByText(/R1 card check and refunds it/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Add card: pay R0 today/i }))

    await waitFor(() => {
      expect(BillingAPIMock.cardSetup).toHaveBeenCalledWith({ email: 'owner@example.com' })
    })
    expect(BillingAPIMock.checkout).not.toHaveBeenCalled()
    expect(toastFn).not.toHaveBeenCalledWith('You are already on this plan')
  })

  it('says the card is saved and when the first payment is, after the card check', async () => {
    window.Capacitor = { isNativePlatform: () => true, Plugins: { Browser: {} } }
    BillingAPIMock.cardSetup.mockResolvedValue({ url: 'https://checkout.paystack.com/card', reference: 'ref-card' })
    openExternalUrlMock.mockResolvedValue({ kind: 'in-app-browser', onClosed: Promise.resolve() })
    BillingAPIMock.paystackSync.mockResolvedValue({
      synced: true,
      card_saved: true,
      first_charge_date: '2026-12-02T17:07:49.000Z',
    })

    renderBilling()
    await waitFor(() => expect(screen.getByText(/Trial: \d+ days left/i)).toBeInTheDocument())
    fireEvent.click(screen.getAllByRole('button', { name: /^Add card$/i })[0])

    await waitFor(() => expect(BillingAPIMock.paystackSync).toHaveBeenCalledWith('ref-card'))
    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith(expect.stringMatching(/^Card saved\. Nothing is charged until .*2026/)),
    )
    expect(toastMock.success).not.toHaveBeenCalledWith('Subscription activated!')
  })
})

describe('Billing — trial with a card already saved', () => {
  beforeEach(() => {
    Object.values(BillingAPIMock).forEach((m) => m.mockReset?.())
    PlanAPIMock.get.mockReset()
    useAuthMock.mockReturnValue({ user: { email: 'owner@example.com' } })
    toastFn.mockReset()
    Object.values(toastMock).forEach((m) => m.mockReset?.())
    BillingAPIMock.config.mockResolvedValue({ provider: 'paystack' })
    const trialEnd = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString()
    PlanAPIMock.get.mockResolvedValue({
      plan: 'pro',
      status: 'trialing',
      is_active: true,
      is_on_trial: true,
      trial_end: trialEnd,
      current_period_end: trialEnd,
      card_on_file: true,
      has_paystack_subscription: true,
      limits: {},
      usage: {},
    })
  })

  it('shows the first payment date and lets the owner remove the card', async () => {
    BillingAPIMock.cancel.mockResolvedValue({ canceled: true, card_removed: true })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderBilling()
    await waitFor(() => expect(screen.getByText(/Card saved: Pro continues after your trial/i)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /^Add card$/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Remove card/i }))
    await waitFor(() => expect(BillingAPIMock.cancel).toHaveBeenCalled())
    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith(expect.stringMatching(/^Card removed\. Your trial continues until/)),
    )
    confirmSpy.mockRestore()
  })
})
