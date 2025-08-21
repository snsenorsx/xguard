import { useState } from 'react'
import { campaignsService } from '@/services/campaigns.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function CreateCampaignDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (o: boolean) => void; onSuccess: () => void }) {
  const [name, setName] = useState('')
  const [money, setMoney] = useState('')
  const [safe, setSafe] = useState('')
  const [moneyPageRedirectType, setMoneyPageRedirectType] = useState<'301'|'302'|'js'|'meta'|'direct'|'no_action'>('302')
  const [safePageRedirectType, setSafePageRedirectType] = useState<'301'|'302'|'js'|'meta'|'direct'|'no_action'>('direct')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    setLoading(true)
    try {
      await campaignsService.create({ 
        name, 
        moneyPageUrl: money, 
        safePageUrl: safe, 
        moneyPageRedirectType,
        safePageRedirectType
      })
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
          <Input placeholder="Campaign Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Money Page URL (for bots)" value={money} onChange={(e) => setMoney(e.target.value)} />
          <Input placeholder="Safe Page URL (for non-bots)" value={safe} onChange={(e) => setSafe(e.target.value)} />
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Money Page Redirect Type (for bots):</label>
            <select className="w-full border rounded p-2" value={moneyPageRedirectType} onChange={(e) => setMoneyPageRedirectType(e.target.value as any)}>
              <option value="301">301 - Permanent Redirect</option>
              <option value="302">302 - Temporary Redirect</option>
              <option value="js">JavaScript Redirect</option>
              <option value="meta">Meta Refresh</option>
              <option value="direct">Direct Load</option>
              <option value="no_action">No Action (Block)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Safe Page Redirect Type (for non-bots):</label>
            <select className="w-full border rounded p-2" value={safePageRedirectType} onChange={(e) => setSafePageRedirectType(e.target.value as any)}>
              <option value="301">301 - Permanent Redirect</option>
              <option value="302">302 - Temporary Redirect</option>
              <option value="js">JavaScript Redirect</option>
              <option value="meta">Meta Refresh</option>
              <option value="direct">Direct Load</option>
              <option value="no_action">No Action (Block)</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading || !name || !money || !safe}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

