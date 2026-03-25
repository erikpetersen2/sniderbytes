import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getMetrics } from '../api/client'
import MetricCard from '../components/MetricCard'
import type { MetricsPayload } from '../types'

export default function OverviewPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<MetricsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    const clusterId = parseInt(id)

    const fetch = () => {
      getMetrics(clusterId)
        .then(setData)
        .catch(() => setError('Failed to load metrics'))
        .finally(() => setLoading(false))
    }

    setLoading(true)
    setError('')
    fetch()

    const interval = setInterval(fetch, 30_000)
    return () => clearInterval(interval)
  }, [id])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Overview</h1>
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
              name={m.name}
              value={m.value}
              unit={m.unit}
              isMock={data.mock}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
