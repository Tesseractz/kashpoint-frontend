import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ReceiptPrinterCard from './ReceiptPrinterCard'

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
import toast from 'react-hot-toast'

const savedUA = navigator.userAgent
const setUA = (ua) => Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })

function installBridge(settings = { printerName: '', paperWidth: 80, autoPrint: true }) {
  let current = { ...settings }
  const bridge = {
    listPrinters: vi.fn().mockResolvedValue([
      { name: 'Microsoft Print to PDF', isDefault: true },
      { name: 'POS-80', isDefault: false },
    ]),
    getPrintSettings: vi.fn().mockImplementation(async () => current),
    setPrintSettings: vi.fn().mockImplementation(async (patch) => {
      current = { ...current, ...patch }
      return current
    }),
    printReceipt: vi.fn().mockResolvedValue({ ok: true }),
  }
  window.kashpointDesktop = bridge
  return bridge
}

describe('ReceiptPrinterCard', () => {
  afterEach(() => {
    delete window.kashpointDesktop
    setUA(savedUA)
    vi.clearAllMocks()
  })

  it('renders nothing in a browser tab', () => {
    const { container } = render(<ReceiptPrinterCard />)
    expect(container.firstChild).toBeNull()
  })

  it('tells an old desktop app to update', () => {
    setUA('Mozilla/5.0 KashPoint Electron/31.0')
    render(<ReceiptPrinterCard />)
    expect(screen.getByText('Receipt printer')).toBeInTheDocument()
    expect(screen.getByText('Get the latest Windows app').closest('a')).toHaveAttribute('href', 'https://kashpoint.co.za/#download')
  })

  it('lists the printers, saves a choice and prints a test slip', async () => {
    const bridge = installBridge()
    render(<ReceiptPrinterCard />)

    const select = await screen.findByLabelText('Printer')
    await waitFor(() => expect(screen.getByText('POS-80')).toBeInTheDocument())
    expect(screen.getByText('Microsoft Print to PDF (Windows default)')).toBeInTheDocument()

    const testButton = screen.getByRole('button', { name: /Print test receipt/ })
    expect(testButton).toBeDisabled()

    fireEvent.change(select, { target: { value: 'POS-80' } })
    await waitFor(() => expect(bridge.setPrintSettings).toHaveBeenCalledWith({ printerName: 'POS-80' }))

    fireEvent.click(screen.getByRole('button', { name: '58 mm' }))
    await waitFor(() => expect(bridge.setPrintSettings).toHaveBeenCalledWith({ paperWidth: 58 }))

    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => expect(bridge.setPrintSettings).toHaveBeenCalledWith({ autoPrint: false }))

    await waitFor(() => expect(screen.getByRole('button', { name: /Print test receipt/ })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: /Print test receipt/ }))
    await waitFor(() => expect(bridge.printReceipt).toHaveBeenCalledTimes(1))
    expect(bridge.printReceipt.mock.calls[0][0]).toContain('Printer test')
    expect(bridge.printReceipt.mock.calls[0][0]).toContain('width:58mm')
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Test receipt sent to the printer'))
  })

  it('keeps a saved printer that is no longer installed visible', async () => {
    installBridge({ printerName: 'Old-Till', paperWidth: 80, autoPrint: true })
    render(<ReceiptPrinterCard />)
    const select = await screen.findByLabelText('Printer')
    await waitFor(() => expect(select.value).toBe('Old-Till'))
    expect(screen.getByText('Old-Till (not found)')).toBeInTheDocument()
  })
})
