import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Pencil, Copy, Trash2, Users, UserPlus, Store } from 'lucide-react'
import { AdminAPI } from '../../api/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { Dialog } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { Skeleton } from '../../components/ui/Skeleton'
import { PageError } from './bits'
import { apiError, fmtDate, partnerSignupLink } from './format'

function useAdminMutation(mutationFn, onSuccess) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin'] })
      onSuccess?.(data)
    },
    onError: (e) => toast.error(apiError(e)),
  })
}

async function copyText(text, what) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${what} copied`)
  } catch {
    toast.error('Could not copy. Select it and copy by hand.')
  }
}

function PartnerDialog({ open, onClose, partner }) {
  const isNew = !partner
  const [form, setForm] = useState(() => ({
    name: partner?.name || '',
    code: partner?.code || '',
    contact_name: partner?.contact_name || '',
    contact_phone: partner?.contact_phone || '',
    contact_email: partner?.contact_email || '',
    notes: partner?.notes || '',
  }))
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const save = useAdminMutation(
    () => (isNew ? AdminAPI.createPartner(form) : AdminAPI.updatePartner(partner.id, form)),
    () => {
      toast.success(isNew ? 'Partner added' : 'Partner updated')
      onClose()
    },
  )
  const valid = form.name.trim().length > 0 && form.code.trim().length >= 2
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? 'New partner' : `Edit ${partner.name}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : isNew ? 'Add partner' : 'Save'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Input label="Business name" value={form.name} onChange={set('name')} placeholder="TechZone Computers" maxLength={80} />
        <Input
          label="Partner code"
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
          placeholder="TECHZONE"
          maxLength={24}
          hint="Letters, digits and dashes. Their customers type this at sign-up, or follow the link with it."
        />
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Contact person" value={form.contact_name} onChange={set('contact_name')} maxLength={80} />
          <Input label="Phone" type="tel" value={form.contact_phone} onChange={set('contact_phone')} maxLength={30} />
        </div>
        <Input label="Email" type="email" value={form.contact_email} onChange={set('contact_email')} maxLength={120} />
        <Input label="Notes" value={form.notes} onChange={set('notes')} placeholder="Commission agreed, hardware they sell…" maxLength={2000} />
      </div>
    </Dialog>
  )
}

function AddLogin({ partnerId }) {
  const [email, setEmail] = useState('')
  const add = useAdminMutation(() => AdminAPI.addPartnerAdmin(partnerId, email.trim()), () => {
    toast.success('Login added')
    setEmail('')
  })
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (email.trim()) add.mutate()
      }}
    >
      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their KashPoint login email" aria-label="Partner login email" className="h-9" />
      <Button type="submit" size="sm" variant="secondary" disabled={!email.trim() || add.isPending} className="h-9 flex-shrink-0">
        <UserPlus size={14} /> Add login
      </Button>
    </form>
  )
}

function PartnerCard({ p, onEdit }) {
  const remove = useAdminMutation((userId) => AdminAPI.removePartnerAdmin(p.id, userId), () => toast.success('Login removed'))
  const link = partnerSignupLink(p.code)
  return (
    <Card>
      <CardHeader className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="truncate">{p.name}</CardTitle>
          <CardDescription>
            {[p.contact_name, p.contact_phone, p.contact_email].filter(Boolean).join(' · ') || 'No contact details yet'}
          </CardDescription>
        </div>
        <Button size="sm" variant="ghost" onClick={onEdit} aria-label={`Edit ${p.name}`}>
          <Pencil size={14} /> Edit
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">{p.code}</Badge>
          <Link to={`/admin/stores?partner=${p.id}`} className="inline-flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 hover:underline">
            <Store size={14} aria-hidden /> {p.stores_count} store{p.stores_count === 1 ? '' : 's'}
          </Link>
          <span className="text-xs text-slate-400">since {fmtDate(p.created_at)}</span>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Sign-up link to give them</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200">{link}</code>
            <Button size="xs" variant="secondary" onClick={() => copyText(link, 'Link')} aria-label="Copy sign-up link">
              <Copy size={12} /> Copy
            </Button>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Who can open their partner view</p>
          {p.admins?.length ? (
            <ul className="mt-1 space-y-1">
              {p.admins.map((a) => (
                <li key={a.user_id} className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <span className="truncate">{a.email}</span>
                  <button
                    type="button"
                    onClick={() => remove.mutate(a.user_id)}
                    className="p-1 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                    aria-label={`Remove ${a.email}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Nobody yet. They need a KashPoint account first (any sign-up works), then add its email here.</p>
          )}
          <div className="mt-2">
            <AddLogin partnerId={p.id} />
          </div>
        </div>
        {p.notes && <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{p.notes}</p>}
      </CardContent>
    </Card>
  )
}

function StaffCard() {
  const q = useQuery({ queryKey: ['admin', 'admins'], queryFn: AdminAPI.admins })
  const [email, setEmail] = useState('')
  const add = useAdminMutation(() => AdminAPI.addAdmin(email.trim()), () => {
    toast.success('Staff account added')
    setEmail('')
  })
  const remove = useAdminMutation((userId) => AdminAPI.removeAdmin(userId), () => toast.success('Removed'))
  const staff = (q.data?.items || []).filter((a) => a.role === 'owner')
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users size={18} aria-hidden /> KashPoint staff
        </CardTitle>
        <CardDescription>Accounts that see and manage every store. Keep this list short.</CardDescription>
      </CardHeader>
      {q.isError && (
        <CardContent>
          <PageError error={q.error} onRetry={() => q.refetch()} />
        </CardContent>
      )}
      {!q.data && !q.isError && (
        <CardContent>
          <Skeleton className="h-10" />
        </CardContent>
      )}
      {q.data && (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {staff.map((a) => (
            <li key={a.user_id} className="px-5 sm:px-6 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-slate-900 dark:text-white truncate">
                  {a.email}
                  {a.is_you && <Badge tone="neutral" size="sm" className="ml-2">you</Badge>}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">since {fmtDate(a.created_at)}</p>
              </div>
              {!a.is_you && (
                <button type="button" onClick={() => remove.mutate(a.user_id)} className="p-1 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400" aria-label={`Remove ${a.email}`}>
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <CardContent className="border-t border-slate-100 dark:border-slate-800">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (email.trim()) add.mutate()
          }}
        >
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague's KashPoint login email" aria-label="Staff email" className="h-9" />
          <Button type="submit" size="sm" variant="secondary" disabled={!email.trim() || add.isPending} className="h-9 flex-shrink-0">
            <UserPlus size={14} /> Add staff
          </Button>
        </form>
        {q.data?.bootstrap_emails?.length > 0 && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Also staff via the server's PLATFORM_ADMIN_EMAILS setting: {q.data.bootstrap_emails.join(', ')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function AdminPartners() {
  const q = useQuery({ queryKey: ['admin', 'partners'], queryFn: AdminAPI.partners })
  const [editing, setEditing] = useState(null) // null | 'new' | partner

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Partners</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Computer shops that sell tills with KashPoint. Each gets a code and a read-only view of the stores it brings in.</p>
          </div>
          <Button onClick={() => setEditing('new')}>
            <Plus size={16} /> New partner
          </Button>
        </div>

        {q.isError && <PageError error={q.error} onRetry={() => q.refetch()} />}
        {!q.data && !q.isError && (
          <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        )}
        {q.data && q.data.items.length === 0 && (
          <Card>
            <EmptyState
              icon={Users}
              title="No partners yet"
              description="Add the first computer shop, give them their code, and their customers' stores will appear under their name."
              action={<Button onClick={() => setEditing('new')}><Plus size={16} /> New partner</Button>}
              compact
            />
          </Card>
        )}
        {q.data && q.data.items.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {q.data.items.map((p) => (
              <PartnerCard key={p.id} p={p} onEdit={() => setEditing(p)} />
            ))}
          </div>
        )}
      </section>

      <StaffCard />

      {editing && (
        <PartnerDialog key={editing === 'new' ? 'new' : editing.id} open onClose={() => setEditing(null)} partner={editing === 'new' ? null : editing} />
      )}
    </div>
  )
}
