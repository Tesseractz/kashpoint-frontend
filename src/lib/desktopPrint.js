// Printing through the KashPoint Windows app.
//
// The desktop shell (electron/preload.js) exposes `window.kashpointDesktop`
// when it is new enough to print; a browser tab, the Android app and older
// installers have no such object. Everything here degrades to "not available"
// so the Sell screen can fall back to the ordinary print dialog.
import { receiptHtml } from './receiptHtml'
import { isElectron } from './platform'

export function desktopBridge() {
  if (typeof window === 'undefined') return null
  const b = window.kashpointDesktop
  return b && typeof b.printReceipt === 'function' ? b : null
}

/** True inside a desktop app that can print receipts silently. */
export function hasDesktopPrinting() {
  return !!desktopBridge()
}

/** True inside a desktop app too old to print: tell the owner to update it. */
export function desktopNeedsUpdate() {
  return isElectron() && !hasDesktopPrinting()
}

export async function listPrinters() {
  const b = desktopBridge()
  if (!b) return []
  try {
    const list = await b.listPrinters()
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export async function getPrintSettings() {
  const b = desktopBridge()
  if (!b) return null
  try {
    return (await b.getPrintSettings()) || null
  } catch {
    return null
  }
}

export async function savePrintSettings(patch) {
  const b = desktopBridge()
  if (!b) return null
  return b.setPrintSettings(patch)
}

/**
 * Print a receipt (as built by lib/receipt.js buildReceipt) on the printer
 * chosen on this computer. Resolves to { ok, error?, reason? }; never throws.
 */
export async function printReceipt(receipt, settings) {
  const b = desktopBridge()
  if (!b) return { ok: false, error: 'Automatic printing needs the KashPoint Windows app.', reason: 'unavailable' }
  const s = settings || (await getPrintSettings()) || {}
  if (!s.printerName) {
    return {
      ok: false,
      error: 'No receipt printer has been chosen yet. Pick one under Profile → Receipt printer.',
      reason: 'unconfigured',
    }
  }
  try {
    const result = await b.printReceipt(receiptHtml(receipt, { paperWidth: s.paperWidth }))
    if (result && typeof result === 'object' && 'ok' in result) return result
    return { ok: false, error: 'No reply from the printer.' }
  } catch (e) {
    return { ok: false, error: e?.message || 'Printing failed.' }
  }
}
