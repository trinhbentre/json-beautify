import { useRef } from 'react'
import { AppHeader } from '@web-tools/ui'
import type { HistoryEntry } from '../lib/storageService'
import { HistoryDropdown } from './HistoryDropdown'

function JsonIconSvg() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

type Indent = 2 | 4 | 'tab'

interface HeaderProps {
  indent: Indent
  onIndentChange: (v: Indent) => void
  sortKeys: boolean
  onToggleSortKeys: () => void
  onFormat: () => void
  onMinify: () => void
  onRepair: () => void
  repairDisabled: boolean
  onClear: () => void
  historyEntries: HistoryEntry[]
  onRestore: (id: string) => void
  onRemove: (id: string) => void
  onClearHistory: () => void
  onExportHistory: () => void
  onImportHistory: (file: File) => void
  onOpenFile: (file: File) => void
  onLoadUrl: (url: string) => void
  onPiiMask: () => void
  piiDisabled: boolean
}

const indentOptions: { label: string; value: Indent }[] = [
  { label: '2', value: 2 },
  { label: '4', value: 4 },
  { label: 'Tab', value: 'tab' },
]

export function Header({
  indent, onIndentChange,
  sortKeys, onToggleSortKeys,
  onFormat, onMinify, onRepair, repairDisabled,
  onClear,
  historyEntries, onRestore, onRemove, onClearHistory, onExportHistory, onImportHistory,
  onOpenFile, onLoadUrl,
  onPiiMask, piiDisabled,
}: HeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUrlClick = () => {
    const url = window.prompt('Enter JSON URL:')
    if (url?.trim()) onLoadUrl(url.trim())
  }

  return (
    <AppHeader
      toolName="JSON Pro Editor"
      toolIcon={<JsonIconSvg />}
      actions={
        <>
          {/* Format / Minify / Repair */}
          <button className="btn-primary" onClick={onFormat}>Format</button>
          <button className="btn-secondary" onClick={onMinify}>Minify</button>
          <button className="btn-secondary" onClick={onRepair} disabled={repairDisabled} title="Auto-fix trailing commas, single quotes, missing quotes on keys">
            Repair
          </button>

          <div className="w-px h-4 bg-surface-600 mx-0.5 flex-shrink-0" />

          <span className="text-text-muted text-xs flex-shrink-0">Indent:</span>
          {indentOptions.map(({ label, value }) => (
            <button
              key={label}
              onClick={() => onIndentChange(value)}
              className={`btn ${indent === value ? 'bg-accent text-surface-900' : 'bg-surface-700 text-text-secondary border border-surface-600 hover:bg-surface-600'}`}
            >
              {label}
            </button>
          ))}

          <div className="w-px h-4 bg-surface-600 mx-0.5 flex-shrink-0" />

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.jsonl,.geojson,application/json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onOpenFile(f) }}
          />
          <button className="btn-secondary" title="Open JSON file" onClick={() => fileInputRef.current?.click()}>
            📂 Open
          </button>
          <button className="btn-secondary" title="Load JSON from URL" onClick={handleUrlClick}>
            🌐 URL
          </button>

          <div className="w-px h-4 bg-surface-600 mx-0.5 flex-shrink-0" />

          <button
            className="btn-secondary"
            title={piiDisabled ? 'Not available for large files' : 'Scan and mask PII data'}
            onClick={onPiiMask}
            disabled={piiDisabled}
          >
            🛡️ PII
          </button>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={onToggleSortKeys}
              title="Sort object keys alphabetically"
              className={`btn ${sortKeys ? 'bg-accent text-surface-900' : 'bg-surface-700 text-text-secondary border border-surface-600 hover:bg-surface-600'}`}
            >
              Sort Keys
            </button>
            <HistoryDropdown
              entries={historyEntries}
              onRestore={onRestore}
              onRemove={onRemove}
              onClearAll={onClearHistory}
              onExport={onExportHistory}
              onImport={onImportHistory}
            />
            <button className="btn-danger" onClick={onClear}>Clear</button>
          </div>
        </>
      }
    />
  )
}
