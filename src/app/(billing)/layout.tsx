export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0f1117' }}>
      <header className="flex items-center justify-center h-16 border-b border-white/10">
        <span
          className="text-xl font-bold tracking-tight"
          style={{ color: '#F7F3EC', fontFamily: 'Georgia, serif' }}
        >
          Byline
        </span>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
