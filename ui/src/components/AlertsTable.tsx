import type { Alert } from '../types'

interface AlertsTableProps {
  alerts: Alert[]
  isMock: boolean
}

const severityConfig = {
  critical: 'bg-ops-danger/20 text-ops-danger border border-ops-danger/30',
  warning: 'bg-ops-warning/20 text-ops-warning border border-ops-warning/30',
  info: 'bg-ops-info/20 text-ops-info border border-ops-info/30',
}

const statusConfig = {
  firing: 'text-ops-danger',
  pending: 'text-ops-warning',
  resolved: 'text-ops-success',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function AlertsTable({ alerts, isMock }: AlertsTableProps) {
  if (alerts.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-ops-success text-4xl mb-3">✓</div>
        <div className="text-white font-medium">All clear</div>
        <div className="text-ops-muted text-sm mt-1">No active alerts</div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      {isMock && (
        <div className="mb-3 text-xs text-ops-muted font-mono flex items-center gap-1">
          <span className="text-ops-warning">⚠</span> Showing demo data — no Grafana connection
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ops-border">
            <th className="text-left text-xs text-ops-muted uppercase tracking-wider py-2 pr-4 font-normal">Alert</th>
            <th className="text-left text-xs text-ops-muted uppercase tracking-wider py-2 pr-4 font-normal">Severity</th>
            <th className="text-left text-xs text-ops-muted uppercase tracking-wider py-2 pr-4 font-normal">Status</th>
            <th className="text-left text-xs text-ops-muted uppercase tracking-wider py-2 font-normal">Last Updated</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert, i) => (
            <tr key={i} className="border-b border-ops-border/50 hover:bg-ops-border/20 transition-colors">
              <td className="py-3 pr-4 font-mono text-white">{alert.name}</td>
              <td className="py-3 pr-4">
                <span className={`text-xs px-2 py-1 rounded font-mono ${severityConfig[alert.severity] ?? 'text-ops-muted'}`}>
                  {alert.severity}
                </span>
              </td>
              <td className={`py-3 pr-4 font-mono text-sm ${statusConfig[alert.status] ?? 'text-ops-muted'}`}>
                {alert.status === 'firing' && <span className="mr-1">●</span>}
                {alert.status}
              </td>
              <td className="py-3 text-ops-muted text-xs font-mono">
                {timeAgo(alert.last_updated)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
