interface MetricCardProps {
  name: string
  value: number
  unit: string
  isMock?: boolean
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

export default function MetricCard({ name, value, unit, isMock }: MetricCardProps) {
  const colorClass = getColorClass(name, value)
  const displayValue = Number.isInteger(value) ? value : value.toFixed(2)

  return (
    <div className="bg-ops-surface border border-ops-border rounded-lg p-4 relative">
      {isMock && (
        <span className="absolute top-2 right-2 text-xs text-ops-muted bg-ops-bg px-1.5 py-0.5 rounded font-mono">
          demo
        </span>
      )}
      <div className="text-xs text-ops-muted uppercase tracking-wider mb-2 font-mono">{name}</div>
      <div className={`text-3xl font-bold font-mono ${colorClass}`}>
        {displayValue}
        {unit && <span className="text-lg text-ops-muted ml-1">{unit}</span>}
      </div>
    </div>
  )
}
