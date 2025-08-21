import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { campaignsService } from '@/services/campaigns.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function TargetingPage() {
  const { id, streamId } = useParams()
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  async function fetchRules() {
    if (!id || !streamId) return
    setLoading(true)
    try {
      const data = await campaignsService.getStreamTargeting(id, streamId)
      setRules(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRules() }, [id, streamId])

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Targeting Kuralları</h1>
      <Card>
        <CardHeader>
          <CardTitle>Kurallar</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? 'Yükleniyor...' : (
            <div className="space-y-3">
              {rules.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="text-sm">{r.ruleType} {r.operator} {JSON.stringify(r.value)} [{r.isInclude ? 'include' : 'exclude'}]</div>
                </div>
              ))}
              {rules.length === 0 && <div className="text-sm text-muted-foreground">Kural yok</div>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

