import axios from 'axios'
import type { AlertsPayload, Cluster, LoginResponse, MetricsPayload } from '../types'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export async function login(username: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { username, password })
  return data
}

export async function getClusters(): Promise<Cluster[]> {
  const { data } = await api.get<Cluster[]>('/clusters')
  return data
}

export async function getMetrics(clusterId: number): Promise<MetricsPayload> {
  const { data } = await api.get<MetricsPayload>(`/clusters/${clusterId}/metrics`)
  return data
}

export async function getAlerts(clusterId: number): Promise<AlertsPayload> {
  const { data } = await api.get<AlertsPayload>(`/clusters/${clusterId}/alerts`)
  return data
}
