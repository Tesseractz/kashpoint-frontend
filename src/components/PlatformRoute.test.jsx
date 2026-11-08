import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const { auth } = vi.hoisted(() => ({
  auth: { isAuthenticated: true, loading: false, profile: { role: 'admin' }, profileLoading: false, isPlatformAdmin: false },
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))

import PlatformRoute from './PlatformRoute'

function renderPortal() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route
          path="/admin"
          element={
            <PlatformRoute>
              <div>the portal</div>
            </PlatformRoute>
          }
        />
        <Route path="/auth" element={<div>sign in</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PlatformRoute', () => {
  beforeEach(() => {
    Object.assign(auth, { isAuthenticated: true, loading: false, profile: { role: 'admin' }, profileLoading: false, isPlatformAdmin: false })
  })

  it('shows the portal to platform admins', () => {
    Object.assign(auth, { isPlatformAdmin: true, profile: { role: 'admin', platform_role: 'owner' } })
    renderPortal()
    expect(screen.getByText('the portal')).toBeInTheDocument()
  })

  it('refuses ordinary store accounts', () => {
    renderPortal()
    expect(screen.getByText('Staff only')).toBeInTheDocument()
    expect(screen.queryByText('the portal')).toBeNull()
  })

  it('waits for the profile instead of refusing a cold load', () => {
    Object.assign(auth, { profile: null, profileLoading: true })
    renderPortal()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('Staff only')).toBeNull()
  })

  it('sends signed-out visitors to sign in', () => {
    Object.assign(auth, { isAuthenticated: false, profile: null })
    renderPortal()
    expect(screen.getByText('sign in')).toBeInTheDocument()
  })
})
