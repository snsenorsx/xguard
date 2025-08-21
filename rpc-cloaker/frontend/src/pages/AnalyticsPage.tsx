import { useQuery } from '@tanstack/react-query'
import { analyticsService } from '@/services/analytics.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function AnalyticsPage() {
  const { data } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => analyticsService.getOverview({
      from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      to: new Date().toISOString(),
    }),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Analytics</h1>
      <Card>
        <CardHeader>
          <CardTitle>Overview (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Stat label="Total" value={data?.totalVisits ?? 0} />
            <Stat label="Bots" value={data?.totalBots ?? 0} />
            <Stat label="Humans" value={data?.totalHumans ?? 0} />
            <Stat label="Avg Resp (ms)" value={Math.round(data?.avgResponseTime ?? 0)} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}

