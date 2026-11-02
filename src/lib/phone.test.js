import { describe, it, expect } from 'vitest'
import { normalizePhone } from './phone'

describe('normalizePhone', () => {
  it.each(['082 123 4567', '0821234567', '+27 82 123 4567', '27821234567', '(082) 123-4567', '0027821234567'])(
    'reads %s as the same South African number',
    (raw) => {
      expect(normalizePhone(raw)).toBe('+27821234567')
    },
  )

  it('keeps a foreign number that has its country code', () => {
    expect(normalizePhone('+44 7700 900123')).toBe('+447700900123')
  })

  it.each([null, undefined, '', '12345', '082 123 456', '+27 82 123 45678', 'hello'])(
    'rejects %s',
    (raw) => {
      expect(normalizePhone(raw)).toBeNull()
    },
  )
})
