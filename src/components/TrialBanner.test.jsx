import { describe, it, expect } from 'vitest'
import { trialBannerState } from './TrialBanner'

const DAY = 24 * 60 * 60 * 1000
const now = Date.parse('2026-11-02T12:00:00Z')
const inDays = (d) => new Date(now + d * DAY).toISOString()

describe('trialBannerState', () => {
  it('counts down a trial without a card', () => {
    const s = trialBannerState({ is_on_trial: true, is_active: true, status: 'trialing', trial_end: inDays(20) }, now)
    expect(s).toMatchObject({ kind: 'trial', daysLeft: 20 })
  })

  it('turns urgent in the last week', () => {
    const s = trialBannerState({ is_on_trial: true, is_active: true, status: 'trialing', trial_end: inDays(3) }, now)
    expect(s).toMatchObject({ kind: 'ending', daysLeft: 3 })
  })

  it('says nothing once a card is saved', () => {
    expect(
      trialBannerState({ is_on_trial: true, is_active: true, status: 'trialing', trial_end: inDays(3), card_on_file: true }, now),
    ).toBeNull()
  })

  it('tells a shop whose trial ran out how to get Pro back', () => {
    const s = trialBannerState({ is_on_trial: false, is_active: false, status: 'trialing', trial_end: inDays(-2) }, now)
    expect(s).toMatchObject({ kind: 'ended', canceled: false })
  })

  it('says nothing to a paying shop', () => {
    expect(trialBannerState({ is_on_trial: false, is_active: true, status: 'active', trial_end: inDays(-40) }, now)).toBeNull()
  })

  it('says nothing while the first payment is being charged (grace)', () => {
    expect(
      trialBannerState({ is_on_trial: false, is_active: true, status: 'trialing', trial_end: inDays(-1), card_on_file: true }, now),
    ).toBeNull()
  })

  it('says nothing when the plan could not be read', () => {
    expect(trialBannerState({ degraded: true, is_on_trial: false, is_active: true }, now)).toBeNull()
    expect(trialBannerState(undefined, now)).toBeNull()
  })
})
