export function Header() {
  return (
    <header className="border-b border-surface-700 bg-surface-800">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <a
          href="https://trinhbentre.github.io"
          className="text-text-secondary hover:text-accent text-sm transition-colors"
        >
          ← trinhbentre.github.io
        </a>
        <span className="text-surface-600">|</span>
        <span className="text-text-primary text-sm font-semibold">JSON Beautify</span>
        <span className="ml-auto text-xs text-success/70 border border-success/20 rounded px-2 py-0.5">🔒 100% Client-side</span>
      </div>
    </header>
  )
}
