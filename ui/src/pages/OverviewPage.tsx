import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getMetrics, getNamespaces, getClusterPanels } from '../api/client'
import MetricCard from '../components/MetricCard'
import type { MetricsPayload, Panel } from '../types'

export default function OverviewPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<MetricsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [namespace, setNamespace] = useState('')
  const [panels, setPanels] = useState<Panel[]>([])

  // Fetch namespace list and panel exprs once per cluster
  useEffect(() => {
    if (!id) return
    const clusterId = parseInt(id)
    setNamespaces([])
    setNamespace('')
    setPanels([])
    getNamespaces(clusterId).then(setNamespaces).catch(() => {})
    getClusterPanels(clusterId).then(setPanels).catch(() => {})
  }, [id])

  // Fetch metrics whenever cluster or namespace changes; reset 30s poll
  useEffect(() => {
    if (!id) return
    const clusterId = parseInt(id)

    const fetch = () => {
      getMetrics(clusterId, namespace || undefined)
        .then(setData)
        .catch(() => setError('Failed to load metrics'))
        .finally(() => setLoading(false))
    }

    setLoading(true)
    setError('')
    fetch()

    const interval = setInterval(fetch, 30_000)
    return () => clearInterval(interval)
  }, [id, namespace])

  // When a panel is saved, update our local panel expr so the next edit opens current value
  const handlePanelSaved = (panelId: number, name: string, expr: string, unit: string) => {
    setPanels((prev) =>
      prev.map((p) => (p.id === panelId ? { ...p, name, expr, unit } : p))
    )
  }

  const clusterId = id ? parseInt(id) : 0
  const panelExprMap = Object.fromEntries(panels.map((p) => [p.id, p.expr]))

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-white">Overview</h1>
          {namespaces.length > 0 && (
            <select
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              className="bg-ops-surface border border-ops-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-ops-accent"
            >
              <option value="">All namespaces</option>
              {namespaces.map((ns) => (
                <option key={ns} value={ns}>{ns}</option>
              ))}
            </select>
          )}
        </div>
        {data && (
          <span className="text-xs text-ops-muted font-mono">
            Updated {new Date(data.fetched_at).toLocaleTimeString()}
            {data.mock && (
              <span className="ml-2 text-ops-warning">⚠ demo data</span>
            )}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-ops-danger/10 border border-ops-danger/30 rounded p-3 text-ops-danger text-sm mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-ops-surface border border-ops-border rounded-lg p-4 h-24 animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.metrics.map((m) => (
            <MetricCard
              key={m.name}
              clusterId={clusterId}
              panelId={m.panel_id}
              name={m.name}
              value={m.value}
              unit={m.unit}
              expr={m.panel_id ? panelExprMap[m.panel_id] : undefined}
              isMock={data.mock}
              namespace={namespace}
              onSaved={handlePanelSaved}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
