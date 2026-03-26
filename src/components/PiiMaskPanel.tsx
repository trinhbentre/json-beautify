import { useState, useCallback, useMemo } from 'react'
import { DEFAULT_PATTERNS, detectPii, maskJson, unmaskJson } from '../lib/piiDetector'
import type { PiiPattern, PiiMatch } from '../lib/piiDetector'

interface PiiMaskPanelProps {
  json: unknown | null
  onApplyMask: (maskedJsonString: string) => void
  onClose: () => void
}

function groupByPattern(matches: PiiMatch[]): Map<string, PiiMatch[]> {
  const map = new Map<string, PiiMatch[]>()
  for (const m of matches) {
    const arr = map.get(m.patternId) ?? []
    arr.push(m)
    map.set(m.patternId, arr)
  }
  return map
}

function truncate(s: string, max = 40): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

export function PiiMaskPanel({ json, onApplyMask, onClose }: PiiMaskPanelProps) {
  const [patterns, setPatterns] = useState<PiiPattern[]>(
    () => DEFAULT_PATTERNS.map(p => ({ ...p, regex: new RegExp(p.regex.source, p.regex.flags) }))
  )
  const [matches, setMatches] = useState<PiiMatch[]>([])
  const [maskMode, setMaskMode] = useState<'asterisk' | 'hash'>('asterisk')
  const [originalJson, setOriginalJson] = useState<unknown | null>(null)
  const [masked, setMasked] = useState(false)
  const [applying, setApplying] = useState(false)
  const [scanned, setScanned] = useState(false)

  const grouped = useMemo(() => groupByPattern(matches), [matches])

  const handleScan = useCallback(() => {
    if (!json) return
    const found = detectPii(json, patterns)
    setMatches(found)
    setScanned(true)
    setMasked(false)
  }, [json, patterns])

  const togglePattern = useCallback((id: string) => {
    setPatterns(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p))
    setScanned(false)
  }, [])

  const handleApplyMask = useCallback(async () => {
    if (!json || !matches.length) return
    setApplying(true)
    try {
      const maskedData = await maskJson(json, matches, maskMode)
      setOriginalJson(json)
      setMasked(true)
      onApplyMask(JSON.stringify(maskedData, null, 2))
    } finally {
      setApplying(false)
    }
  }, [json, matches, maskMode, onApplyMask])

  const handleUnmask = useCallback(() => {
    if (!originalJson) return
    setMasked(false)
    onApplyMask(JSON.stringify(unmaskJson(json, originalJson), null, 2))
    setOriginalJson(null)
  }, [originalJson, json, onApplyMask])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-96 bg-surface-800 border-l border-surface-700 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base">🛡️</span>
            <span className="font-semibold text-sm text-text-primary">PII Mask</span>
          </div>
          <button
            className="text-text-muted hover:text-text-primary text-lg leading-none"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-4">
          {/* Pattern toggles */}
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Detect Patterns</p>
            <div className="flex flex-col gap-1.5">
              {patterns.map(p => {
                const count = grouped.get(p.id)?.length ?? 0
                return (
                  <label key={p.id} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={p.enabled}
                      onChange={() => togglePattern(p.id)}
                      className="accent-accent w-3.5 h-3.5"
                    />
                    <span className="text-sm text-text-secondary flex-1 group-hover:text-text-primary">{p.label}</span>
                    {scanned && count > 0 && (
                      <span className="text-[10px] font-semibold bg-danger/20 text-danger rounded px-1.5 py-0.5 leading-none">
                        {count}
                      </span>
                    )}
                    {scanned && count === 0 && (
                      <span className="text-[10px] text-text-muted">0</span>
                    )}
                  </label>
                )
              })}
            </div>
          </div>

          {/* Mode selector */}
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Masking Mode</p>
            <div className="flex gap-3">
              {(['asterisk', 'hash'] as const).map(mode => (
                <label key={mode} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="maskMode"
                    value={mode}
                    checked={maskMode === mode}
                    onChange={() => setMaskMode(mode)}
                    className="accent-accent"
                  />
                  <span className="text-sm text-text-secondary">
                    {mode === 'asterisk' ? 'Asterisk (****)' : 'Hash (SHA-256)'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Scan results */}
          {scanned && (
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Scan Results
                <span className="ml-2 text-text-primary">{matches.length} match{matches.length !== 1 ? 'es' : ''}</span>
              </p>
              {matches.length === 0 ? (
                <p className="text-sm text-success">✓ No PII detected</p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                  {Array.from(grouped.entries()).map(([patternId, patternMatches]) => {
                    const pattern = patterns.find(p => p.id === patternId)
                    return (
                      <div key={patternId} className="bg-surface-700 rounded p-2">
                        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                          {pattern?.label ?? patternId} ({patternMatches.length})
                        </p>
                        <div className="flex flex-col gap-1">
                          {patternMatches.slice(0, 5).map((m, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <code className="text-accent font-mono shrink-0">{m.path || '(root)'}</code>
                              <span className="text-danger truncate">
                                {truncate(m.originalValue.slice(m.startIndex, m.endIndex))}
                              </span>
                            </div>
                          ))}
                          {patternMatches.length > 5 && (
                            <p className="text-[10px] text-text-muted">+{patternMatches.length - 5} more</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {!json && (
            <p className="text-sm text-text-muted text-center mt-4">Parse valid JSON first to scan for PII.</p>
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0 border-t border-surface-700 p-4 flex flex-col gap-2">
          <button
            className="btn-primary w-full"
            onClick={handleScan}
            disabled={!json}
          >
            🔍 Scan
          </button>
          <button
            className="btn-primary w-full"
            onClick={handleApplyMask}
            disabled={!scanned || matches.length === 0 || masked || applying}
          >
            {applying ? 'Applying…' : '🛡️ Apply Mask'}
          </button>
          {masked && (
            <button
              className="btn-secondary w-full"
              onClick={handleUnmask}
            >
              ↩ Unmask
            </button>
          )}
        </div>
      </div>
    </>
  )
}
