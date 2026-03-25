import axios from 'axios'
import type { AlertsPayload, Cluster, ClusterAdmin, EnvironmentOption, LoginResponse, MetricsPayload, User } from '../types'

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
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    if (err.response?.status === 403 && !err.config?.url?.includes('/auth/')) {
      window.location.href = '/'
    }
    return Promise.reject(err)
  }
)

export async function login(username: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { username, password })
  return data
}

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
  const { data } = await api.get<User[]>('/admin/users')
  return data
}

export async function getAdminClusters(): Promise<ClusterAdmin[]> {
  const { data } = await api.get<ClusterAdmin[]>('/admin/clusters')
  return data
}

export interface ClusterWriteRequest {
  name: string
  environment_id: number
  grafana_url: string
  grafana_auth_type: 'token' | 'keycloak'
  grafana_token: string
  grafana_client_id: string
  grafana_token_url: string
}

export async function createAdminCluster(req: ClusterWriteRequest): Promise<{ id: number }> {
  const { data } = await api.post<{ id: number }>('/admin/clusters', req)
  return data
}

export async function updateAdminCluster(id: number, req: Partial<ClusterWriteRequest>): Promise<void> {
  await api.put(`/admin/clusters/${id}`, req)
}

export async function deleteAdminCluster(id: number): Promise<void> {
  await api.delete(`/admin/clusters/${id}`)
}

export async function getEnvironments(): Promise<EnvironmentOption[]> {
  const { data } = await api.get<EnvironmentOption[]>('/admin/environments')
  return data
}

export async function createOrganization(customerName: string, environmentName: string): Promise<void> {
  await api.post('/admin/organizations', { customer_name: customerName, environment_name: environmentName })
}
