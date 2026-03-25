import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getAlerts } from '../api/client'
import AlertsTable from '../components/AlertsTable'
import type { AlertsPayload } from '../types'

export default function AlertsPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<AlertsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    const clusterId = parseInt(id)

    const fetch = () => {
      getAlerts(clusterId)
        .then(setData)
        .catch(() => setError('Failed to load alerts'))
        .finally(() => setLoading(false))
    }

    setLoading(true)
    setError('')
    fetch()

    const interval = setInterval(fetch, 60_000)
    return () => clearInterval(interval)
  }, [id])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Alerts</h1>
        {data && (
          <span className="text-xs text-ops-muted font-mono">
            {data.alerts.filter((a) => a.status === 'firing').length} firing
          </span>
        )}
      </div>

      {error && (
        <div className="bg-ops-danger/10 border border-ops-danger/30 rounded p-3 text-ops-danger text-sm mb-4">
          {error}
        </div>
      )}

      <div className="bg-ops-surface border border-ops-border rounded-lg p-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-ops-border rounded animate-pulse" />
            ))}
          </div>
        ) : data ? (
          <AlertsTable alerts={data.alerts} isMock={data.mock} />
        ) : null}
      </div>
    </div>
  )
}
