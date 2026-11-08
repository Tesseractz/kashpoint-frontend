import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildReceipt } from './receipt'
import {
  hasDesktopPrinting,
  desktopNeedsUpdate,
  listPrinters,
  getPrintSettings,
  savePrintSettings,
  printReceipt,
} from './desktopPrint'

const receipt = buildReceipt({ store: { name: 'Spaza' }, items: [{ name: 'Bread', quantity: 1, price: 18 }] })
const savedUA = navigator.userAgent

function setUA(ua) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
}

function installBridge(overrides = {}) {
  const bridge = {
    listPrinters: vi.fn().mockResolvedValue([{ name: 'POS-80', isDefault: false }]),
    getPrintSettings: vi.fn().mockResolvedValue({ printerName: 'POS-80', paperWidth: 58, autoPrint: true }),
    setPrintSettings: vi.fn().mockImplementation(async (p) => ({ printerName: 'POS-80', paperWidth: 58, autoPrint: true, ...p })),
    printReceipt: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  }
  window.kashpointDesktop = bridge
  return bridge
}

describe('desktopPrint', () => {
  beforeEach(() => {
    delete window.kashpointDesktop
  })
  afterEach(() => {
    delete window.kashpointDesktop
    setUA(savedUA)
  })

  it('is unavailable in a browser tab', async () => {
    expect(hasDesktopPrinting()).toBe(false)
    expect(desktopNeedsUpdate()).toBe(false)
    expect(await listPrinters()).toEqual([])
    expect(await getPrintSettings()).toBeNull()
    expect(await savePrintSettings({ autoPrint: false })).toBeNull()
    const res = await printReceipt(receipt)
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('unavailable')
  })

  it('asks for an update inside an old desktop app', () => {
    setUA('Mozilla/5.0 KashPoint Electron/31.0')
    expect(hasDesktopPrinting()).toBe(false)
    expect(desktopNeedsUpdate()).toBe(true)
  })

  it('prints the receipt as HTML sized to the saved paper width', async () => {
    const bridge = installBridge()
    expect(hasDesktopPrinting()).toBe(true)
    expect(desktopNeedsUpdate()).toBe(false)
    expect(await listPrinters()).toEqual([{ name: 'POS-80', isDefault: false }])

    const res = await printReceipt(receipt)
    expect(res).toEqual({ ok: true })
    expect(bridge.printReceipt).toHaveBeenCalledTimes(1)
    const html = bridge.printReceipt.mock.calls[0][0]
    expect(html).toContain('width:58mm')
    expect(html).toContain('Spaza')
    expect(html).toContain('Bread')
  })

  it('refuses without a chosen printer and passes the bridge error through', async () => {
    const bridge = installBridge({
      getPrintSettings: vi.fn().mockResolvedValue({ printerName: '', paperWidth: 80, autoPrint: true }),
    })
    const unset = await printReceipt(receipt)
    expect(unset.ok).toBe(false)
    expect(unset.reason).toBe('unconfigured')
    expect(bridge.printReceipt).not.toHaveBeenCalled()

    bridge.printReceipt.mockResolvedValue({ ok: false, error: 'The printer "POS-80" is not installed on this computer.' })
    const failed = await printReceipt(receipt, { printerName: 'POS-80', paperWidth: 80 })
    expect(failed.ok).toBe(false)
    expect(failed.error).toContain('not installed')

    bridge.printReceipt.mockRejectedValue(new Error('boom'))
    const threw = await printReceipt(receipt, { printerName: 'POS-80', paperWidth: 80 })
    expect(threw).toEqual({ ok: false, error: 'boom' })
  })

  it('saves settings through the bridge', async () => {
    const bridge = installBridge()
    const saved = await savePrintSettings({ autoPrint: false })
    expect(bridge.setPrintSettings).toHaveBeenCalledWith({ autoPrint: false })
    expect(saved.autoPrint).toBe(false)
  })
})
