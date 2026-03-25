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
  panel_id?: number
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

export interface ClusterAdmin {
  id: number
  name: string
  environment: string
  environment_id: number
  customer: string
  grafana_url: string
  grafana_auth_type: 'token' | 'keycloak'
  grafana_client_id: string
  grafana_token_url: string
}

export interface EnvironmentOption {
  id: number
  name: string
  customer: string
}

export interface Panel {
  id: number
  name: string
  expr: string
  unit: string
  position: number
}
