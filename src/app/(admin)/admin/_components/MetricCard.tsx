interface MetricCardProps {
  label: string
  value: string | number
  sub?: string
  icon?: React.ElementType
}

/** A single business/usage metric tile. Mirrors the dashboard's StatCard styling. */
export default function MetricCard({ label, value, sub, icon: Icon }: MetricCardProps) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--ink-card)', border: '1px solid rgba(184,115,51,0.18)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--cream-faint)]">{label}</span>
        {Icon && (
          <span className="inline-flex p-1.5 rounded-lg" style={{ background: 'rgba(184,115,51,0.12)' }}>
            <Icon className="w-4 h-4" style={{ color: '#B87333' }} />
          </span>
        )}
      </div>
      <div className="text-3xl font-bold text-[var(--cream)] tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {sub && <div className="mt-1 text-xs text-[var(--cream-dim)]">{sub}</div>}
    </div>
  )
}
