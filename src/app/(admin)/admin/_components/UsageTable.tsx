import type { ReactNode } from 'react'

export interface Column {
  key: string
  label: string
  align?: 'left' | 'right'
}

interface UsageTableProps {
  columns: Column[]
  rows: Array<Record<string, ReactNode>>
  empty?: string
}

/** Generic dark-theme data table used for the cost-by-feature / cost-by-model grids. */
export default function UsageTable({ columns, rows, empty = 'No data yet.' }: UsageTableProps) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--ink-card)', border: '1px solid rgba(184,115,51,0.18)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(184,115,51,0.15)' }}>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--cream-faint)] ${c.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-[var(--cream-dim)]">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="transition-colors hover:bg-[var(--ink-deep)]" style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(184,115,51,0.08)' }}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 py-3 text-[var(--cream)] ${c.align === 'right' ? 'text-right tabular-nums' : 'text-left'}`}
                  >
                    {row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
