import { useState, useEffect, useRef } from 'react'
import { queryDebounced, cancelQuery } from '../lib/jqService'

interface JQSearchPanelProps {
  data: unknown
  onHighlight?: (paths: Set<string>) => void
}

const EXAMPLES = [
  { label: 'Keys', expr: 'keys' },
  { label: 'Length', expr: 'length' },
  { label: 'First element', expr: '.[0]' },
  { label: 'Select', expr: '.[] | select(.id != null)' },
  { label: 'Map pick', expr: '[.[] | {id, name}]' },
]

export function JQSearchPanel({ data }: JQSearchPanelProps) {
  const [expression, setExpression] = useState('')
  const [result, setResult] = useState<{ values: unknown[]; error?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [showCheatsheet, setShowCheatsheet] = useState(false)
  const prevExpr = useRef('')
  const prevData = useRef<unknown>(undefined)

  useEffect(() => {
    const expr = expression.trim()
    if (!expr || data == null) {
      setResult(null)
      setLoading(false)
      cancelQuery()
      return
    }
    if (expr === prevExpr.current && data === prevData.current) return
    prevExpr.current = expr
    prevData.current = data
    setLoading(true)
    queryDebounced(expr, data, (r) => {
      setResult(r)
      setLoading(false)
    })
    return () => cancelQuery()
  }, [expression, data])

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Input row */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-text-muted text-xs font-mono shrink-0">jq</span>
        <input
          type="text"
          value={expression}
          onChange={e => setExpression(e.target.value)}
          placeholder=".users | map(select(.active))"
          className="flex-1 bg-surface-900 border border-surface-700 rounded px-3 py-1 text-sm font-mono text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50"
          spellCheck={false}
        />
        {loading && (
          <span className="text-text-muted text-xs shrink-0 animate-pulse">…</span>
        )}
        {expression && (
          <button
            onClick={() => { setExpression(''); setResult(null); cancelQuery() }}
            className="btn text-xs px-2 py-1 bg-surface-700 text-text-secondary border border-surface-600 hover:bg-surface-600 shrink-0"
          >
            ✕
          </button>
        )}
        <button
          onClick={() => setShowCheatsheet(s => !s)}
          className={`btn text-xs px-2 py-1 border shrink-0 ${showCheatsheet ? 'bg-accent text-surface-900 border-accent' : 'bg-surface-700 text-text-secondary border-surface-600 hover:bg-surface-600'}`}
          title="JQ syntax quick reference"
        >
          ?
        </button>
      </div>

      {/* Quick examples */}
      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
        {EXAMPLES.map(ex => (
          <button
            key={ex.expr}
            onClick={() => setExpression(ex.expr)}
            className="text-xs px-2 py-0.5 rounded bg-surface-700 text-text-muted hover:text-text-secondary border border-surface-600 hover:bg-surface-600 transition-colors"
          >
            {ex.label}
          </button>
        ))}
      </div>

      {/* Cheatsheet */}
      {showCheatsheet && (
        <div className="shrink-0 bg-surface-800 border border-surface-700 rounded p-3 text-xs font-mono space-y-1 text-text-secondary">
          <p><span className="text-accent">.</span> — identity / root</p>
          <p><span className="text-accent">.foo</span> — object field</p>
          <p><span className="text-accent">.[]</span> — iterate array/object</p>
          <p><span className="text-accent">.[0]</span> — array index</p>
          <p><span className="text-accent">.[2:5]</span> — slice</p>
          <p><span className="text-accent">keys</span>, <span className="text-accent">values</span>, <span className="text-accent">length</span></p>
          <p><span className="text-accent">select(cond)</span> — filter</p>
          <p><span className="text-accent">map(expr)</span> — transform array</p>
          <p><span className="text-accent">|</span> — pipe</p>
          <p><span className="text-accent">has("key")</span>, <span className="text-accent">in</span></p>
          <p><span className="text-accent">to_entries</span>, <span className="text-accent">from_entries</span></p>
          <p><span className="text-accent">sort_by(.field)</span>, <span className="text-accent">group_by(.field)</span></p>
        </div>
      )}

      {/* Error */}
      {result?.error && (
        <div className="shrink-0 text-danger text-xs font-mono bg-danger/10 border border-danger/20 rounded px-3 py-2">
          {result.error}
        </div>
      )}

      {/* Results list */}
      {result && !result.error && (
        <div className="flex-1 min-h-0 overflow-auto rounded border border-surface-700/50 bg-surface-900/40 p-2">
          {result.values.length === 0 ? (
            <p className="text-text-muted text-xs italic p-2">No results</p>
          ) : (
            <div className="space-y-1">
              <p className="text-text-muted text-xs mb-2">
                {result.values.length} result{result.values.length !== 1 ? 's' : ''}
              </p>
              {result.values.map((v, i) => (
                <div key={i} className="text-xs font-mono bg-surface-800 rounded px-3 py-2 border border-surface-700">
                  <pre className="whitespace-pre-wrap break-all text-text-primary">
                    {JSON.stringify(v, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
