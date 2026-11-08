import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Printer, RefreshCw, Download } from 'lucide-react'
import { Button } from './ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card'
import { buildReceipt } from '../lib/receipt'
import { PAPER_WIDTHS } from '../lib/receiptHtml'
import {
  hasDesktopPrinting,
  desktopNeedsUpdate,
  listPrinters,
  getPrintSettings,
  savePrintSettings,
  printReceipt,
} from '../lib/desktopPrint'

// Which printer this till prints receipts on, and whether a slip comes out
// by itself after every sale. The choice belongs to the computer, not the
// account, so it is saved by the desktop app rather than in the database.
// Shown only inside the Windows app; a browser tab has nothing to set.

const TEST_RECEIPT = buildReceipt({
  store: { name: 'Printer test', receipt_footer: 'If you can read this, your printer is set up.' },
  items: [
    { name: 'White bread 700g', quantity: 1, price: 18.99 },
    { name: 'Coca-Cola 500ml', quantity: 2, price: 17.99 },
  ],
  paymentMethod: 'cash',
  paymentAmount: 60,
  number: 'TEST',
})

const selectClass =
  'w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm'

export default function ReceiptPrinterCard() {
  const available = hasDesktopPrinting()
  const needsUpdate = !available && desktopNeedsUpdate()
  const [printers, setPrinters] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [list, current] = await Promise.all([listPrinters(), getPrintSettings()])
      setPrinters(list)
      setSettings(current || { printerName: '', paperWidth: 80, autoPrint: true })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (available) load()
  }, [available])

  if (!available && !needsUpdate) return null

  if (needsUpdate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Receipt printer
          </CardTitle>
          <CardDescription>
            This version of the Windows app prints through the print dialog. Update it to print a slip
            automatically after every sale.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a href="https://kashpoint.co.za/#download" target="_blank" rel="noopener noreferrer">
            <Button variant="outline">
              <Download size={16} />
              Get the latest Windows app
            </Button>
          </a>
        </CardContent>
      </Card>
    )
  }

  const update = async (patch) => {
    const next = { ...(settings || {}), ...patch }
    setSettings(next)
    try {
      const saved = await savePrintSettings(patch)
      if (saved) setSettings(saved)
    } catch {
      toast.error('Could not save the printer settings')
    }
  }

  const testPrint = async () => {
    setTesting(true)
    try {
      const res = await printReceipt(TEST_RECEIPT, settings)
      if (res.ok) toast.success('Test receipt sent to the printer')
      else toast.error(res.error || 'Test print failed')
    } finally {
      setTesting(false)
    }
  }

  const chosen = settings?.printerName || ''
  const chosenMissing = chosen && !printers.some((p) => p.name === chosen)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="w-5 h-5" />
          Receipt printer
        </CardTitle>
        <CardDescription>
          Receipts print straight to this printer, with no dialog. Settings apply to this computer only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="receipt-printer" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Printer
            </label>
            <Button variant="ghost" size="xs" onClick={load} disabled={loading} title="Look for printers again">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
          <select
            id="receipt-printer"
            className={selectClass}
            value={chosen}
            onChange={(e) => update({ printerName: e.target.value })}
          >
            <option value="">Choose a printer…</option>
            {chosenMissing && <option value={chosen}>{chosen} (not found)</option>}
            {printers.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
                {p.isDefault ? ' (Windows default)' : ''}
              </option>
            ))}
          </select>
          {printers.length === 0 && !loading && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              No printers found. Install the printer in Windows first, then press Refresh.
            </p>
          )}
        </div>

        <div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Paper width</div>
          <div className="flex gap-2">
            {PAPER_WIDTHS.map((w) => (
              <Button
                key={w}
                type="button"
                variant={Number(settings?.paperWidth) === w ? 'primary' : 'outline'}
                size="sm"
                onClick={() => update({ paperWidth: w })}
              >
                {w} mm
              </Button>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            Most till printers take 80 mm rolls; the small handheld ones take 58 mm.
          </p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            checked={!!settings?.autoPrint}
            onChange={(e) => update({ autoPrint: e.target.checked })}
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">
            <span className="font-medium">Print a receipt after every sale</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              The slip prints the moment you press Complete Sale. You can still print again from the receipt screen.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button onClick={testPrint} disabled={!chosen || testing}>
            <Printer size={16} />
            {testing ? 'Printing…' : 'Print test receipt'}
          </Button>
          {!chosen && <span className="text-xs text-slate-500 dark:text-slate-400">Choose a printer first.</span>}
        </div>
      </CardContent>
    </Card>
  )
}
