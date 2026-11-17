import { describe, it, expect, beforeEach, vi } from 'vitest'

// The module remembers whether it has loaded, so each test gets a fresh copy.
async function fresh() {
  vi.resetModules()
  return import('./metaPixel.js')
}

describe('metaPixel', () => {
  beforeEach(() => {
    localStorage.clear()
    delete window.fbq
    delete window._fbq
    document.head.querySelectorAll('script[src*="fbevents"]').forEach((s) => s.remove())
  })

  it('loads nothing without marketing consent', async () => {
    const px = await fresh()
    expect(px.loadPixel()).toBe(false)
    expect(px.trackSignup()).toBe(false)
    expect(window.fbq).toBeUndefined()
    expect(document.querySelector('script[src*="fbevents"]')).toBeNull()
  })

  it('treats "analytics only" as no consent for ads', async () => {
    localStorage.setItem('cookie_consent', JSON.stringify({ essential: true, analytics: true, marketing: false }))
    const px = await fresh()
    expect(px.loadPixel()).toBe(false)
  })

  it('ignores a damaged consent record', async () => {
    localStorage.setItem('cookie_consent', '{not json')
    const px = await fresh()
    expect(px.hasMarketingConsent()).toBe(false)
    expect(px.loadPixel()).toBe(false)
  })

  it('with consent: one script, init with our id, one page view', async () => {
    localStorage.setItem('cookie_consent', JSON.stringify({ essential: true, marketing: true }))
    const px = await fresh()
    expect(px.loadPixel()).toBe(true)
    expect(px.loadPixel()).toBe(true) // second call does nothing new
    expect(document.querySelectorAll('script[src*="fbevents"]').length).toBe(1)
    expect(window.fbq.queue).toEqual([
      ['set', 'autoConfig', false, '825330948916743'],
      ['init', '825330948916743'],
      ['track', 'PageView'],
    ])
  })

  it('does not follow the app past the sign-up page', async () => {
    localStorage.setItem('cookie_consent', JSON.stringify({ essential: true, marketing: true }))
    const px = await fresh()
    px.loadPixel()
    // no PageView per screen of the till, and no automatic button reports
    expect(window.fbq.disablePushState).toBe(true)
    expect(window.fbq.queue[0]).toEqual(['set', 'autoConfig', false, '825330948916743'])
  })

  it('records a completed sign-up', async () => {
    localStorage.setItem('cookie_consent', JSON.stringify({ essential: true, marketing: true }))
    const px = await fresh()
    expect(px.trackSignup()).toBe(true)
    expect(window.fbq.queue.at(-1)).toEqual(['track', 'CompleteRegistration'])
  })
})
