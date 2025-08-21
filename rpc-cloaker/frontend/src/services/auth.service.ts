import { api } from '@/lib/api'

export interface LoginResponse {
  user: {
    id: string
    email: string
    name: string
    role: string
  }
  token: string
  refreshToken: string
}

export interface RegisterResponse extends LoginResponse {}

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post('/auth/login', { email, password })
    return data
  },

  async register(email: string, password: string, name: string): Promise<RegisterResponse> {
    const { data } = await api.post('/auth/register', { email, password, name })
    return data
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout')
  },

  async getMe() {
    const { data } = await api.get('/auth/me')
    return data.user
  },

  async refreshToken(refreshToken: string) {
    const { data } = await api.post('/auth/refresh', { refreshToken })
    return data
  },
}