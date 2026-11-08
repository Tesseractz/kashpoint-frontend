import { describe, it, expect } from 'vitest'
import { ago, relativeDays, stateTone, subscriptionLine, actionLabel, partnerSignupLink, apiError } from './format'

const NOW = Date.UTC(2026, 10, 8, 12, 0, 0)
const at = (ms) => new Date(NOW + ms).toISOString()
const DAY = 86400000

describe('admin portal formatting', () => {
  it('says how long ago in plain words', () => {
    expect(ago(null, NOW)).toBe('never')
    expect(ago(at(-30_000), NOW)).toBe('just now')
    expect(ago(at(-5 * 60_000), NOW)).toBe('5 min ago')
    expect(ago(at(-3 * 3_600_000), NOW)).toBe('3 h ago')
    expect(ago(at(-DAY), NOW)).toBe('1 day ago')
    expect(ago(at(-3 * DAY), NOW)).toBe('3 days ago')
    expect(ago(at(-45 * DAY), NOW)).toBe('1 month ago')
    expect(ago('garbage', NOW)).toBe('—')
  })

  it('counts days forwards and backwards', () => {
    expect(relativeDays(at(12 * DAY), NOW)).toBe('in 12 days')
    expect(relativeDays(at(DAY), NOW)).toBe('in 1 day')
    expect(relativeDays(at(-3 * DAY), NOW)).toBe('3 days ago')
    expect(relativeDays(null, NOW)).toBe('—')
  })

  it('maps every state to a badge tone and unknown ones to neutral', () => {
    expect(stateTone('trial')).toBe('success')
    expect(stateTone('trial_ending')).toBe('warning')
    expect(stateTone('active')).toBe('brand')
    expect(stateTone('suspended')).toBe('danger')
    expect(stateTone('comped')).toBe('info')
    expect(stateTone('whatever')).toBe('neutral')
  })

  it('writes the one-liner under the badge', () => {
    expect(subscriptionLine({ state: 'trial', days_left: 12 })).toBe('12 days left')
    expect(subscriptionLine({ state: 'trial_ending', days_left: 1, card_on_file: true })).toBe('1 day left · card saved')
    expect(subscriptionLine({ state: 'comped', comp_until: '2026-12-31T00:00:00Z' })).toMatch(/^until /)
    expect(subscriptionLine({ state: 'active', paid_through: '2026-11-28T00:00:00Z' })).toMatch(/^renews /)
    expect(subscriptionLine({ state: 'active' })).toBe('active')
    expect(subscriptionLine({ state: 'trial_ended', trial_end: at(-3 * DAY) }, NOW)).toBe('ended 3 days ago')
    expect(subscriptionLine({ state: 'expired' })).toBe('on free limits')
    expect(subscriptionLine(null)).toBe('')
  })

  it('names actions for people and falls back to the raw code', () => {
    expect(actionLabel('trial.extend')).toBe('Extended trial')
    expect(actionLabel('store.suspend')).toBe('Suspended store')
    expect(actionLabel('something.new')).toBe('something.new')
  })

  it('builds the sign-up link a partner hands out', () => {
    expect(partnerSignupLink('TECHZONE', 'https://app.kashpoint.co.za')).toBe('https://app.kashpoint.co.za/auth?mode=signup&ref=TECHZONE')
    expect(partnerSignupLink('PC PALACE', 'https://x.test')).toBe('https://x.test/auth?mode=signup&ref=PC%20PALACE')
  })

  it('prefers the API detail in errors', () => {
    expect(apiError({ response: { data: { detail: 'Partner not found' } }, message: 'Request failed' })).toBe('Partner not found')
    expect(apiError({ message: 'Network Error' })).toBe('Network Error')
    expect(apiError(null, 'fallback')).toBe('fallback')
  })
})
