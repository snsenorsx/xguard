import { useEffect, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { analyticsService } from '@/services/analytics.service'
import { format } from 'date-fns'

export function RealtimeChart() {
  const [data, setData] = useState<any[]>([])

  const { data: timeSeriesData } = useQuery({
    queryKey: ['realtime-traffic'],
    queryFn: () => analyticsService.getTimeSeries({
      from: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      to: new Date().toISOString(),
      metric: 'requests',
      interval: '1m',
    }),
    refetchInterval: 5000, // Refresh every 5 seconds
  })

  useEffect(() => {
    if (timeSeriesData) {
      setData(timeSeriesData.map((item: any) => ({
        time: format(new Date(item.time), 'HH:mm'),
        value: item.value,
      })))
    }
  }, [timeSeriesData])

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <XAxis
          dataKey="time"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col">
                      <span className="text-[0.70rem] uppercase text-muted-foreground">
                        Time
                      </span>
                      <span className="font-bold text-muted-foreground">
                        {payload[0].payload.time}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[0.70rem] uppercase text-muted-foreground">
                        Requests
                      </span>
                      <span className="font-bold">
                        {payload[0].value}
                      </span>
                    </div>
                  </div>
                </div>
              )
            }
            return null
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}