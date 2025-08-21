import { api } from '@/lib/api'

export interface Campaign {
  id: string
  name: string
  status: 'active' | 'paused' | 'completed'
  moneyPageUrl: string
  safePageUrl: string
  redirectType: '301' | '302' | 'js' | 'meta' | 'direct'
  notes?: string
  createdAt: string
  updatedAt: string
  stats?: {
    totalVisits: number
    botVisits: number
    humanVisits: number
    conversionRate: number
  }
}

export interface Stream {
  id: string
  campaignId: string
  name: string
  weight: number
  isActive: boolean
  moneyPageOverride?: string
  safePageOverride?: string
  createdAt: string
  updatedAt: string
}

export interface CreateCampaignDto {
  name: string
  moneyPageUrl: string
  safePageUrl: string
  redirectType: '301' | '302' | 'js' | 'meta' | 'direct'
  notes?: string
}

export interface UpdateCampaignDto extends Partial<CreateCampaignDto> {
  status?: 'active' | 'paused' | 'completed'
}

export const campaignsService = {
  async list(params?: { page?: number; limit?: number; status?: string }) {
    const { data } = await api.get('/campaigns', { params })
    return data
  },

  async get(id: string) {
    const { data } = await api.get(`/campaigns/${id}`)
    return data
  },

  async create(campaign: CreateCampaignDto) {
    const { data } = await api.post('/campaigns', campaign)
    return data
  },

  async update(id: string, campaign: UpdateCampaignDto) {
    const { data } = await api.patch(`/campaigns/${id}`, campaign)
    return data
  },

  async delete(id: string) {
    await api.delete(`/campaigns/${id}`)
  },

  async getStreams(campaignId: string) {
    const { data } = await api.get(`/campaigns/${campaignId}/streams`)
    return data
  },

  async getStreamTargeting(campaignId: string, streamId: string) {
    const { data } = await api.get(`/campaigns/${campaignId}/streams/${streamId}/targeting`)
    return data
  },

  async createStream(campaignId: string, stream: Partial<Stream>) {
    const { data } = await api.post(`/campaigns/${campaignId}/streams`, stream)
    return data
  },

  async updateStream(campaignId: string, streamId: string, stream: Partial<Stream>) {
    const { data } = await api.patch(`/campaigns/${campaignId}/streams/${streamId}`, stream)
    return data
  },

  async deleteStream(campaignId: string, streamId: string) {
    await api.delete(`/campaigns/${campaignId}/streams/${streamId}`)
  },
}