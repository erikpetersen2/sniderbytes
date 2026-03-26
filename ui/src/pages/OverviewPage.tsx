import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getMetrics, getNamespaces, getClusterPanels, createPanelForCluster, testQueryForCluster } from '../api/client'
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

  // add panel form
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', expr: '', unit: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')
  const [addQueryRunning, setAddQueryRunning] = useState(false)
  const [addQueryResult, setAddQueryResult] = useState<{ value?: number; error?: string } | null>(null)

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

  const handlePanelDeleted = (panelId: number) => {
    setPanels((prev) => prev.filter((p) => p.id !== panelId))
    // Re-fetch metrics so the deleted card disappears
    if (id) getMetrics(parseInt(id), namespace || undefined).then(setData).catch(() => {})
  }

  const openAddPanel = () => {
    setAddForm({ name: '', expr: '', unit: '' })
    setAddError('')
    setAddQueryResult(null)
    setShowAddPanel(true)
  }

  const handleAddRunQuery = async () => {
    if (!addForm.expr.trim() || !id) return
    setAddQueryRunning(true)
    setAddQueryResult(null)
    try {
      const result = await testQueryForCluster(parseInt(id), addForm.expr, namespace)
      setAddQueryResult({ value: result.value })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Query failed'
      setAddQueryResult({ error: msg })
    } finally {
      setAddQueryRunning(false)
    }
  }

  const handleAddSave = async () => {
    if (!id || !addForm.name.trim() || !addForm.expr.trim()) return
    setAddSaving(true)
    setAddError('')
    try {
      await createPanelForCluster(parseInt(id), addForm)
      setShowAddPanel(false)
      // Refresh panels and metrics
      const [updatedPanels, updatedMetrics] = await Promise.all([
        getClusterPanels(parseInt(id)),
        getMetrics(parseInt(id), namespace || undefined),
      ])
      setPanels(updatedPanels)
      setData(updatedMetrics)
    } catch {
      setAddError('Failed to add panel.')
    } finally {
      setAddSaving(false)
    }
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
        <div className="flex items-center gap-4">
          {data && (
            <span className="text-xs text-ops-muted font-mono">
              Updated {new Date(data.fetched_at).toLocaleTimeString()}
              {data.mock && (
                <span className="ml-2 text-ops-warning">⚠ demo data</span>
              )}
            </span>
          )}
          <button
            onClick={openAddPanel}
            className="text-xs border border-ops-accent text-ops-accent font-semibold px-3 py-1 rounded hover:bg-ops-accent/10 transition-colors"
          >
            + Add Panel
          </button>
        </div>
      </div>

      {showAddPanel && (
        <div className="bg-ops-surface border border-ops-accent/50 rounded-lg p-4 space-y-2 mb-6">
          <div className="text-xs font-semibold text-white">New Panel</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-ops-muted mb-1">Name</label>
              <input
                type="text"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Request Latency"
                className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-ops-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-ops-muted mb-1">Unit</label>
              <input
                type="text"
                value={addForm.unit}
                onChange={(e) => setAddForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="e.g. ms, %, req/s"
                className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-ops-accent"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-ops-muted mb-1">PromQL Expression</label>
            <textarea
              rows={3}
              value={addForm.expr}
              onChange={(e) => { setAddForm((f) => ({ ...f, expr: e.target.value })); setAddQueryResult(null) }}
              placeholder={`histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{namespace=~"$namespace"}[5m])) by (le)) * 1000`}
              className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-ops-accent resize-none"
            />
            <div className="flex items-center gap-3 mt-1">
              <button
                type="button"
                onClick={handleAddRunQuery}
                disabled={addQueryRunning || !addForm.expr.trim()}
                className="text-xs text-ops-accent border border-ops-accent px-2 py-0.5 rounded hover:bg-ops-accent/10 transition-colors disabled:opacity-40"
              >
                {addQueryRunning ? 'Running…' : '▶ Run'}
              </button>
              {addQueryResult && (
                addQueryResult.error
                  ? <span className="text-xs text-ops-danger font-mono">{addQueryResult.error}</span>
                  : <span className="text-xs text-ops-success font-mono">→ {addQueryResult.value?.toFixed(4)}</span>
              )}
            </div>
          </div>
          {addError && <p className="text-xs text-ops-danger">{addError}</p>}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAddSave}
              disabled={addSaving || !addForm.name.trim() || !addForm.expr.trim()}
              className="text-xs bg-ops-accent text-black font-semibold px-3 py-1 rounded hover:bg-ops-accent/80 transition-colors disabled:opacity-50"
            >
              {addSaving ? 'Adding…' : 'Add Panel'}
            </button>
            <button
              onClick={() => setShowAddPanel(false)}
              className="text-xs text-ops-muted hover:text-gray-300 px-3 py-1 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
              onDeleted={handlePanelDeleted}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
