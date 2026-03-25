import axios from 'axios'
import type { AlertsPayload, Cluster, MetricsPayload, User } from '../types'

const api = axios.create({ baseURL: '/api' })

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 403) {
      window.location.href = '/'
    }
    return Promise.reject(err)
  }
)

export async function me(): Promise<User> {
  const { data } = await api.get<User>('/auth/me')
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

export async function getUsers(): Promise<User[]> {
  const { data } = await api.get<User[]>('/users')
  return data
}
