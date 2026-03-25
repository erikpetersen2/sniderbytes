import { useState } from 'react'
import { updatePanelForCluster, testQueryForCluster } from '../api/client'

interface MetricCardProps {
  panelId?: number
  clusterId: number
  name: string
  value: number
  unit: string
  expr?: string
  isMock?: boolean
  namespace?: string
  onSaved?: (panelId: number, name: string, expr: string, unit: string) => void
}

function getColorClass(name: string, value: number): string {
  const n = name.toLowerCase()
  if (n.includes('error') || n.includes('cpu') || n.includes('memory')) {
    if (value > 80) return 'text-ops-danger'
    if (value > 60) return 'text-ops-warning'
    return 'text-ops-success'
  }
  return 'text-ops-accent'
}

export default function MetricCard({ panelId, clusterId, name, value, unit, expr: initialExpr, isMock, namespace, onSaved }: MetricCardProps) {
  const colorClass = getColorClass(name, value)
  const displayValue = Number.isInteger(value) ? value : value.toFixed(2)

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(name)
  const [editExpr, setEditExpr] = useState(initialExpr ?? '')
  const [editUnit, setEditUnit] = useState(unit)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [queryRunning, setQueryRunning] = useState(false)
  const [queryResult, setQueryResult] = useState<{ value?: number; error?: string } | null>(null)

  const openEdit = () => {
    setEditName(name)
    setEditExpr(initialExpr ?? '')
    setEditUnit(unit)
    setSaveError('')
    setQueryResult(null)
    setEditing(true)
  }

  const handleSave = async () => {
    if (!panelId) return
    setSaving(true)
    setSaveError('')
    try {
      await updatePanelForCluster(clusterId, panelId, { name: editName, expr: editExpr, unit: editUnit })
      onSaved?.(panelId, editName, editExpr, editUnit)
      setEditing(false)
    } catch {
      setSaveError('Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  const handleRunQuery = async () => {
    if (!editExpr.trim()) return
    setQueryRunning(true)
    setQueryResult(null)
    try {
      const result = await testQueryForCluster(clusterId, editExpr, namespace)
      setQueryResult({ value: result.value })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Query failed'
      setQueryResult({ error: msg })
    } finally {
      setQueryRunning(false)
    }
  }

  if (editing) {
    return (
      <div className="bg-ops-surface border border-ops-accent/50 rounded-lg p-4 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-ops-muted mb-1">Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-ops-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-ops-muted mb-1">Unit</label>
            <input
              type="text"
              value={editUnit}
              onChange={(e) => setEditUnit(e.target.value)}
              className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-ops-accent"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-ops-muted mb-1">PromQL Expression</label>
          <textarea
            rows={3}
            value={editExpr}
            onChange={(e) => { setEditExpr(e.target.value); setQueryResult(null) }}
            className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-ops-accent resize-none"
          />
          <div className="flex items-center gap-3 mt-1">
            <button
              type="button"
              onClick={handleRunQuery}
              disabled={queryRunning || !editExpr.trim()}
              className="text-xs text-ops-accent border border-ops-accent px-2 py-0.5 rounded hover:bg-ops-accent/10 transition-colors disabled:opacity-40"
            >
              {queryRunning ? 'Running…' : '▶ Run'}
            </button>
            {queryResult && (
              queryResult.error
                ? <span className="text-xs text-ops-danger font-mono">{queryResult.error}</span>
                : <span className="text-xs text-ops-success font-mono">→ {queryResult.value?.toFixed(4)}</span>
            )}
          </div>
        </div>
        {saveError && <p className="text-xs text-ops-danger">{saveError}</p>}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving || !editExpr.trim()}
            className="text-xs bg-ops-accent text-black font-semibold px-3 py-1 rounded hover:bg-ops-accent/80 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="text-xs text-ops-muted hover:text-gray-300 px-3 py-1 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-ops-surface border border-ops-border rounded-lg p-4 relative group">
      {isMock && (
        <span className="absolute top-2 right-2 text-xs text-ops-muted bg-ops-bg px-1.5 py-0.5 rounded font-mono">
          demo
        </span>
      )}
      {panelId && !isMock && (
        <button
          onClick={openEdit}
          className="absolute top-2 right-2 text-xs text-ops-muted opacity-0 group-hover:opacity-100 hover:text-white transition-all px-1.5 py-0.5 rounded bg-ops-bg"
        >
          Edit
        </button>
      )}
      <div className="text-xs text-ops-muted uppercase tracking-wider mb-2 font-mono">{name}</div>
      <div className={`text-3xl font-bold font-mono ${colorClass}`}>
        {displayValue}
        {unit && <span className="text-lg text-ops-muted ml-1">{unit}</span>}
      </div>
    </div>
  )
}
