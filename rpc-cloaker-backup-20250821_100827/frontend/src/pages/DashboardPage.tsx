import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Activity,
  Bot,
  Globe,
  TrendingUp,
  Users,
  Zap,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { analyticsService } from '@/services/analytics.service'
import { formatNumber, formatPercent } from '@/lib/utils'
import { RealtimeChart } from '@/components/charts/RealtimeChart'
import { BotDetectionChart } from '@/components/charts/BotDetectionChart'
import { GeographicMap } from '@/components/charts/GeographicMap'

const statCards = [
  {
    title: 'Total Visits',
    icon: Activity,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    title: 'Bot Detection Rate',
    icon: Bot,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
  {
    title: 'Human Traffic',
    icon: Users,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  {
    title: 'Avg Response Time',
    icon: Zap,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    suffix: 'ms',
  },
]

export function DashboardPage() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => analyticsService.getOverview({
      from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      to: new Date().toISOString(),
    }),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const stats: Array<{
    title: string
    icon: any
    color: string
    bgColor: string
    value: number
    change: number
    suffix?: string
    percent?: boolean
  }> = [
    {
      ...statCards[0],
      value: overview?.totalVisits || 0,
      change: 12.5,
    },
    {
      ...statCards[1],
      value: overview?.botRate || 0,
      change: -3.2,
      percent: true,
    },
    {
      ...statCards[2],
      value: overview?.totalHumans || 0,
      change: 8.1,
    },
    {
      ...statCards[3],
      value: overview?.avgResponseTime || 0,
      change: -15.3,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor your traffic and bot detection in real-time
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold">
                    {stat.percent
                      ? formatPercent(stat.value)
                      : formatNumber(stat.value)}
                    {stat.suffix && ` ${stat.suffix}`}
                  </span>
                  <div
                    className={`flex items-center text-sm ${
                      stat.change > 0 ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    {stat.change > 0 ? (
                      <ArrowUp className="w-3 h-3 mr-1" />
                    ) : (
                      <ArrowDown className="w-3 h-3 mr-1" />
                    )}
                    {Math.abs(stat.change)}%
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Real-time Traffic</CardTitle>
              <CardDescription>
                Live traffic flow over the last 30 minutes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RealtimeChart />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Bot Detection Analysis</CardTitle>
              <CardDescription>
                Bot vs Human traffic distribution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BotDetectionChart data={overview} />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Geographic Map */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Geographic Distribution</CardTitle>
                <CardDescription>
                  Traffic sources by country
                </CardDescription>
              </div>
              <Globe className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <GeographicMap data={overview?.topCountries || []} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Recent Bot Detections</CardTitle>
            <CardDescription>
              Latest suspicious activities detected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 rounded-lg bg-accent/50"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                    <div>
                      <p className="text-sm font-medium">
                        Bot detected from datacenter IP
                      </p>
                      <p className="text-xs text-muted-foreground">
                        185.232.{i}.{i * 10} • 2 minutes ago
                      </p>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-red-500">
                    98% confidence
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}