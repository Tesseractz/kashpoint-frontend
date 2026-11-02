import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Receipt, Save, Store, Phone, Mail, Globe, Hash, FileText, MapPin } from 'lucide-react'
import { StoreAPI } from '../api/client'
import { Button } from './ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card'
import { Input } from './ui/Input'
import ImageUpload from './ImageUpload'
import ReceiptSlip from './ReceiptSlip'
import { buildReceipt } from '../lib/receipt'

// What a shop owner fills in once so that every slip, email and WhatsApp
// receipt carries their business, not ours. A VAT number turns receipts into
// tax invoices with the VAT shown.

const FIELDS = [
  'name',
  'logo_url',
  'address',
  'phone',
  'email',
  'website',
  'vat_number',
  'registration_number',
  'receipt_footer',
]

const SAMPLE_ITEMS = [
  { name: 'Bread (white)', quantity: 2, price: 18.99 },
  { name: 'Milk 1L', quantity: 1, price: 22.5 },
  { name: 'Airtime R50', quantity: 1, price: 50 },
]

const pick = (data) =>
  Object.fromEntries(FIELDS.map((k) => [k, data?.[k] == null ? '' : String(data[k])]))

const textareaClass =
  'w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm'

export default function StoreDetailsCard() {
  const qc = useQueryClient()
  const storeQuery = useQuery({
    queryKey: ['store'],
    queryFn: () => StoreAPI.get(),
    staleTime: 30000,
  })
  const [form, setForm] = useState(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (storeQuery.data && !dirty) setForm(pick(storeQuery.data))
  }, [storeQuery.data, dirty])

  const save = useMutation({
    mutationFn: (data) => StoreAPI.update(data),
    onSuccess: (data) => {
      toast.success('Receipt details saved')
      setForm(pick(data))
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['store'] })
      qc.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (e) => {
      const detail = e?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Could not save receipt details', { duration: 6000 })
    },
  })

  if (storeQuery.isError) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-red-600 dark:text-red-400">
          Could not load your store details. Refresh to try again.
        </CardContent>
      </Card>
    )
  }
  if (!form) return null

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value })
    setDirty(true)
  }
  const setLogo = (url) => {
    setForm({ ...form, logo_url: url || '' })
    setDirty(true)
  }

  const preview = buildReceipt({
    store: form,
    items: SAMPLE_ITEMS,
    number: 1,
    paymentMethod: 'cash',
    paymentAmount: 120,
    cashier: 'Thabo',
    date: new Date(),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="w-5 h-5" />
          Receipt & business details
        </CardTitle>
        <CardDescription>
          Printed on every slip and sent with every emailed or WhatsApp receipt. Add your VAT number and
          receipts become tax invoices.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid grid-cols-1 lg:grid-cols-5 gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate(form)
          }}
        >
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-start gap-4">
              <ImageUpload value={form.logo_url} onChange={setLogo} folder="logos" fit="contain" size="lg" />
              <div className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                <p className="font-medium text-slate-700 dark:text-slate-200">Logo</p>
                <p className="mt-1">Shown at the top of receipts. PNG or JPG, up to 5 MB. Square or wide works best.</p>
              </div>
            </div>

            <Input label="Business name" icon={Store} value={form.name} onChange={set('name')} placeholder="Kj General Fashion" required />

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                Address <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <textarea
                  rows={2}
                  value={form.address}
                  onChange={set('address')}
                  placeholder={'12 Market Street, Mayfair\nJohannesburg 2092'}
                  className={`${textareaClass} pl-10`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Phone" icon={Phone} type="tel" value={form.phone} onChange={set('phone')} placeholder="082 123 4567" />
              <Input
                label="Email"
                icon={Mail}
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="shop@example.com"
                hint="Customer replies to emailed receipts go here."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="VAT number"
                icon={Hash}
                value={form.vat_number}
                onChange={set('vat_number')}
                placeholder="4123456789"
                hint="Only if you are VAT registered. Receipts then say TAX INVOICE and show the VAT."
              />
              <Input
                label="Company registration no."
                icon={FileText}
                value={form.registration_number}
                onChange={set('registration_number')}
                placeholder="2020/123456/07"
              />
            </div>

            <Input label="Website" icon={Globe} value={form.website} onChange={set('website')} placeholder="www.yourshop.co.za" />

            <Input
              label="Footer message"
              icon={Receipt}
              value={form.receipt_footer}
              onChange={set('receipt_footer')}
              placeholder="Thank you for your support!"
              hint="One line at the bottom of every receipt, e.g. your returns policy."
            />

            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" disabled={save.isPending || !dirty}>
                <Save className="w-4 h-4" />
                {save.isPending ? 'Saving…' : 'Save receipt details'}
              </Button>
              {dirty && <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</span>}
            </div>
          </div>

          <div className="lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Preview
            </p>
            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-3">
              <ReceiptSlip receipt={preview} className="max-w-[320px] mx-auto shadow-sm" />
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
