import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { supabaseMock, recoveryFlag, ProfileAPIMock } = vi.hoisted(() => ({
  supabaseMock: {
    auth: {
      // A recovery link establishes a real session before the new password is
      // chosen — that is precisely what makes this bug possible.
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'tok', user: { id: 'u1', email: 'a@b.c' } } },
        error: null,
      }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn(),
    },
  },
  recoveryFlag: { value: true },
  ProfileAPIMock: { get: vi.fn().mockResolvedValue({ role: 'admin' }) },
}))

vi.mock('../lib/supabase', () => ({
  supabase: supabaseMock,
  get recoveryInUrl() { return recoveryFlag.value },
  confirmedInUrl: false,
  authErrorInUrl: null,
}))

vi.mock('../api/client', () => ({ ProfileAPI: ProfileAPIMock }))

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}))

import { AuthProvider } from '../context/AuthContext'
import AuthPage from './Auth'

const renderAuth = () =>
  render(
    <MemoryRouter initialEntries={['/auth']}>
      <AuthProvider>
        <AuthPage />
      </AuthProvider>
    </MemoryRouter>
  )

describe('AuthPage — password recovery', () => {
  beforeEach(() => {
    recoveryFlag.value = true
    vi.clearAllMocks()
  })

  it('shows the choose-a-new-password form when opened from a recovery link', async () => {
    renderAuth()
    // The bug: the recovery session logs the user in, and the page shows the
    // ordinary sign-in form (or navigates away) instead of asking for a new
    // password.
    await waitFor(() => {
      expect(screen.getByText(/choose a new password/i)).toBeInTheDocument()
    })
    expect(screen.queryByText(/welcome back/i)).not.toBeInTheDocument()
  })

  it('opens straight on the sign-up form for an ad link ?mode=signup', async () => {
    recoveryFlag.value = false
    window.history.replaceState({}, '', '/auth?mode=signup')
    supabaseMock.auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null })
    renderAuth()
    // Only the sign-up form has a store-name field.
    await waitFor(() => {
      expect(screen.getByPlaceholderText('My Shop')).toBeInTheDocument()
    })
    window.history.replaceState({}, '', '/auth')
  })

  it('shows the normal sign-in form when it is not a recovery link', async () => {
    recoveryFlag.value = false
    renderAuth()
    await waitFor(() => {
      expect(screen.queryByText(/choose a new password/i)).not.toBeInTheDocument()
    })
  })
})
