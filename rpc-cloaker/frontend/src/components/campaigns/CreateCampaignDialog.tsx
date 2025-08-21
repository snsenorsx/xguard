import { useState } from 'react'
import { campaignsService } from '@/services/campaigns.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function CreateCampaignDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (o: boolean) => void; onSuccess: () => void }) {
  const [name, setName] = useState('')
  const [money, setMoney] = useState('')
  const [safe, setSafe] = useState('')
  const [redirectType, setRedirectType] = useState<'301'|'302'|'js'|'meta'|'direct'>('302')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    setLoading(true)
    try {
      await campaignsService.create({ name, moneyPageUrl: money, safePageUrl: safe, redirectType })
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Campaign</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Money page URL" value={money} onChange={(e) => setMoney(e.target.value)} />
          <Input placeholder="Safe page URL" value={safe} onChange={(e) => setSafe(e.target.value)} />
          <select className="w-full border rounded p-2" value={redirectType} onChange={(e) => setRedirectType(e.target.value as any)}>
            {['301','302','js','meta','direct'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading || !name || !money || !safe}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

