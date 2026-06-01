export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#1C1917' }}>
      <header className="flex items-center justify-center h-16 border-b" style={{ borderColor: 'rgba(184,115,51,0.18)' }}>
        <span
          style={{ fontFamily: 'var(--font-playfair, "Playfair Display", serif)', fontSize: '22px', fontWeight: 900, color: '#F7F3EC', letterSpacing: '-0.01em' }}
        >
          byline<span style={{ color: '#B87333' }}>.</span>
        </span>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
