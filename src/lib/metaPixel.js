// Meta Pixel, used only to tell Facebook ads that a sign-up happened.
//
// The privacy policy promises marketing cookies are opt-in, so nothing loads
// until the visitor has accepted "Marketing" in the cookie banner. It is only
// loaded from the sign-up page: the till itself never talks to Meta.

export const PIXEL_ID = '825330948916743'
export const CONSENT_EVENT = 'kp:consent'
const CONSENT_KEY = 'cookie_consent' // written by components/CookieConsent.jsx

let loaded = false

export function hasMarketingConsent() {
  try {
    return !!JSON.parse(window.localStorage.getItem(CONSENT_KEY) || 'null')?.marketing
  } catch {
    return false
  }
}

/** Loads the pixel and records a page view, once, if the visitor said yes. */
export function loadPixel() {
  if (loaded) return true
  if (typeof window === 'undefined' || !hasMarketingConsent()) return false

  // Meta's standard loader: queues calls until fbevents.js arrives.
  if (!window.fbq) {
    const fbq = function (...args) {
      if (fbq.callMethod) fbq.callMethod(...args)
      else fbq.queue.push(args)
    }
    fbq.push = fbq
    fbq.loaded = true
    fbq.version = '2.0'
    fbq.queue = []
    window.fbq = fbq
    if (!window._fbq) window._fbq = fbq
    const s = document.createElement('script')
    s.async = true
    s.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(s)
  }
  window.fbq('init', PIXEL_ID)
  window.fbq('track', 'PageView')
  loaded = true
  return true
}

/** A finished sign-up: the event the ads optimise for. */
export function trackSignup() {
  if (!loadPixel()) return false
  window.fbq('track', 'CompleteRegistration')
  return true
}
