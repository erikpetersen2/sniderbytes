export interface User {
  id: number
  username: string
  role: 'admin' | 'viewer'
}

export interface Cluster {
  id: number
  name: string
  environment: string
  customer: string
  grafana_url: string
}

export interface MetricValue {
  name: string
  value: number
  unit: string
}

export interface MetricsPayload {
  cluster_id: number
  metrics: MetricValue[]
  mock: boolean
  fetched_at: string
}

export interface Alert {
  name: string
  severity: 'critical' | 'warning' | 'info'
  status: 'firing' | 'resolved' | 'pending'
  last_updated: string
}

export interface AlertsPayload {
  cluster_id: number
  alerts: Alert[]
  mock: boolean
}

export interface LoginResponse {
  token: string
  user: User
}
