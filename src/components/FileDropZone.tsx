import { useRef, useState } from 'react'

interface FileDropZoneProps {
  onFile: (file: File) => void
  onUrl: (url: string) => void
  fileInfo?: { name: string; size: number } | null
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function FileDropZone({ onFile, onUrl, fileInfo }: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [urlOpen, setUrlOpen] = useState(false)
  const [urlValue, setUrlValue] = useState('')

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  const handleLoadUrl = () => {
    const trimmed = urlValue.trim()
    if (!trimmed) return
    onUrl(trimmed)
    setUrlOpen(false)
    setUrlValue('')
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-4">
      {/* Drop zone */}
      <div
        className={`w-full max-w-md border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 transition-colors cursor-pointer ${
          dragging
            ? 'border-accent bg-accent/10 text-accent'
            : 'border-surface-600 hover:border-surface-500 text-text-muted hover:text-text-secondary'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <svg className="w-10 h-10 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.338-2.32 3.75 3.75 0 0 1 3.814 3.214 3.75 3.75 0 0 1-.497 7.881H6.75Z" />
        </svg>
        <p className="text-sm font-medium">Drop JSON file here</p>
        <p className="text-xs opacity-60">.json · .jsonl · .geojson</p>
        <input
          ref={inputRef}
          type="file"
          accept=".json,.jsonl,.geojson,application/json"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
        />
      </div>

      {/* File info */}
      {fileInfo && (
        <div className="flex items-center gap-2 text-xs text-text-secondary bg-surface-700 rounded px-3 py-1.5">
          <svg className="w-3.5 h-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <span className="font-medium">{fileInfo.name}</span>
          <span className="text-text-muted">·</span>
          <span>{formatBytes(fileInfo.size)}</span>
        </div>
      )}

      {/* Load URL */}
      {urlOpen ? (
        <div className="flex items-center gap-2 w-full max-w-md">
          <input
            autoFocus
            type="url"
            placeholder="https://example.com/data.json"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLoadUrl(); if (e.key === 'Escape') setUrlOpen(false) }}
            className="flex-1 bg-surface-700 border border-surface-600 rounded px-3 py-1.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
          />
          <button className="btn-primary" onClick={handleLoadUrl}>Load</button>
          <button className="btn-secondary" onClick={() => setUrlOpen(false)}>✕</button>
        </div>
      ) : (
        <button
          className="btn-secondary text-xs"
          onClick={(e) => { e.stopPropagation(); setUrlOpen(true) }}
        >
          🌐 Load from URL
        </button>
      )}
    </div>
  )
}
