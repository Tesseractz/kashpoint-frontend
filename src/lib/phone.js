// Phone numbers from the signup form, in one canonical form (E.164).
//
// Shop owners write the same WhatsApp number many ways: "082 123 4567",
// "0821234567", "+27 82 123 4567", "27821234567". All become +27821234567.
// The backend applies the same rules (app/core/phone.py).

const E164 = /^\+[1-9]\d{7,14}$/

export function normalizePhone(raw) {
  if (raw === null || raw === undefined) return null
  let s = String(raw).replace(/[^\d+]/g, '')
  if (!s) return null
  if (s.startsWith('00')) s = '+' + s.slice(2)
  if (s.startsWith('0') && s.length === 10) s = '+27' + s.slice(1)
  else if (s.startsWith('27') && s.length === 11) s = '+' + s
  if (s.startsWith('+27') && s.length !== 12) return null
  return E164.test(s) ? s : null
}
