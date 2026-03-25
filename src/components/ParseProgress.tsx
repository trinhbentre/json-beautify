interface ParseProgressProps {
  percent: number
  bytesRead: number
  elapsedMs: number
  onCancel: () => void
}

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function ParseProgress({ percent, bytesRead, elapsedMs, onCancel }: ParseProgressProps) {
  const elapsed = elapsedMs < 1000 ? `${elapsedMs}ms` : `${(elapsedMs / 1000).toFixed(1)}s`

  return (
    <div className="w-full px-4 py-2 flex items-center gap-3 bg-surface-800 border-b border-surface-700">
      <div className="flex-1 bg-surface-700 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-150"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-text-muted shrink-0 tabular-nums">
        {percent}% · {formatBytes(bytesRead)} · {elapsed}
      </span>
      <button
        className="text-xs text-danger hover:text-danger/80 shrink-0"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  )
}
