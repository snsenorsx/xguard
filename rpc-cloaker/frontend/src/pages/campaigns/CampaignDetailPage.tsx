import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { campaignsService } from '@/services/campaigns.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function CampaignDetailPage() {
  const { id } = useParams()
  const { data } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => campaignsService.get(id as string),
    enabled: !!id,
  })

  if (!id) return null

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Campaign</h1>
      <Card>
        <CardHeader>
          <CardTitle>{data?.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-muted-foreground">Money URL</div>
              <div className="font-mono break-all">{data?.moneyPageUrl}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Safe URL</div>
              <div className="font-mono break-all">{data?.safePageUrl}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

