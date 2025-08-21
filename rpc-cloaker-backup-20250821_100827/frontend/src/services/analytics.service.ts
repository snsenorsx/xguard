import { api } from '@/lib/api'

export interface AnalyticsOverview {
  totalVisits: number
  totalBots: number
  totalHumans: number
  botRate: number
  avgResponseTime: number
  uniqueVisitors: number
  topCountries: Array<{ country: string; count: number }>
  topDevices: Array<{ device: string; count: number }>
  topBrowsers: Array<{ browser: string; count: number }>
}

export interface TimeSeriesData {
  time: string
  value: number
}

export interface CampaignStats {
  campaignId: string
  campaignName: string
  totalRequests: number
  botRequests: number
  humanRequests: number
  moneyPageShown: number
  safePageShown: number
  avgResponseTime: number
  conversionRate: number
}

export const analyticsService = {
  async getOverview(params: { from: string; to: string; campaignId?: string }) {
    const { data } = await api.get('/analytics/overview', { params })
    return data
  },

  async getTimeSeries(params: {
    from: string
    to: string
    metric: string
    interval: '1m' | '1h' | '1d'
    campaignId?: string
  }) {
    const { data } = await api.get('/analytics/timeseries', { params })
    return data
  },

  async getCampaignStats(params: { from: string; to: string }) {
    const { data } = await api.get('/analytics/campaigns', { params })
    return data
  },

  async getRealtimeStats() {
    const { data } = await api.get('/analytics/realtime')
    return data
  },

  async exportData(params: {
    from: string
    to: string
    format: 'csv' | 'json' | 'pdf'
    campaignId?: string
  }) {
    const { data } = await api.get('/analytics/export', {
      params,
      responseType: 'blob',
    })
    return data
  },
}