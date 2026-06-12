// Streamed instantly on navigation while the dashboard's server data resolves.
// Mirrors the page layout: header, 4 stat cards, the two-column activity row.
function Block({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg ${className}`} style={{ background: 'rgba(184,115,51,0.10)' }} />
}

export default function DashboardLoading() {
  return (
    <div className="p-8 max-w-6xl" style={{ background: 'var(--ink)', minHeight: '100%' }}>
      {/* Header */}
      <div className="mb-8">
        <Block className="h-7 w-64 mb-2" />
        <Block className="h-4 w-80" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl p-5" style={{ background: 'var(--ink-card)', border: '1px solid rgba(184,115,51,0.18)' }}>
            <Block className="h-3 w-24 mb-4" />
            <Block className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Activity row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl p-5" style={{ background: 'var(--ink-card)', border: '1px solid rgba(184,115,51,0.18)' }}>
          <Block className="h-4 w-28 mb-5" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Block className="h-4 w-3/4 mb-2" />
                  <Block className="h-3 w-1/3" />
                </div>
                <Block className="h-6 w-20" />
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-1 rounded-xl p-5" style={{ background: 'var(--ink-card)', border: '1px solid rgba(184,115,51,0.18)' }}>
          <Block className="h-4 w-32 mb-5" />
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i}>
                <Block className="h-4 w-2/3 mb-2" />
                <Block className="h-3 w-1/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
