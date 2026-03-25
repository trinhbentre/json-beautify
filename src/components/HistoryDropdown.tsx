import { useState, useRef, useEffect } from 'react'
import type { HistoryEntry } from '../hooks/useHistory'

interface HistoryDropdownProps {
  entries: HistoryEntry[]
  onRestore: (content: string) => void
  onRemove: (id: string) => void
  onClearAll: () => void
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ts).toLocaleDateString()
}

export function HistoryDropdown({ entries, onRestore, onRemove, onClearAll }: HistoryDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        title="History"
        className={`btn text-xs px-2 py-1 flex items-center gap-1 ${
          open
            ? 'bg-surface-600 text-text-primary border border-surface-500'
            : 'bg-surface-700 text-text-secondary border border-surface-600 hover:bg-surface-600'
        }`}
      >
        <span>🕐</span>
        <span>History</span>
        {entries.length > 0 && (
          <span className="bg-accent text-surface-900 text-[10px] font-bold rounded-full px-1 leading-none py-0.5">
            {entries.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-80 bg-surface-800 border border-surface-600 rounded-lg shadow-xl flex flex-col max-h-96">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-surface-700">
            <span className="text-xs font-medium text-text-secondary">
              {entries.length === 0 ? 'No history' : `${entries.length} entries`}
            </span>
            {entries.length > 0 && (
              <button
                onClick={() => { onClearAll(); setOpen(false) }}
                className="text-xs text-danger hover:text-danger/80 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Entries */}
          {entries.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-6">
              History will appear here after you Format JSON
            </p>
          ) : (
            <ul className="overflow-y-auto flex-1">
              {entries.map(entry => (
                <li
                  key={entry.id}
                  className="flex items-start gap-2 px-3 py-2 hover:bg-surface-700 transition-colors group"
                >
                  <button
                    className="flex-1 text-left min-w-0"
                    onClick={() => { onRestore(entry.content); setOpen(false) }}
                  >
                    <p className="text-xs text-text-primary font-mono truncate">{entry.preview}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">{formatRelative(entry.timestamp)}</p>
                  </button>
                  <button
                    onClick={() => onRemove(entry.id)}
                    className="text-text-muted hover:text-danger transition-colors opacity-0 group-hover:opacity-100 text-xs mt-0.5 shrink-0"
                    title="Remove"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
