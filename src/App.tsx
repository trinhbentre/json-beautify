import { useState, useCallback, useMemo } from 'react'
import { jsonrepair } from 'jsonrepair'
import { Header } from './components/Header'
import { CodeEditor } from './components/CodeEditor'
import { OutputEditor } from './components/OutputEditor'
import { TreeView } from './components/TreeView'
import { ConvertPanel } from './components/ConvertPanel'
import { HistoryDropdown } from './components/HistoryDropdown'
import { useHistory } from './hooks/useHistory'

type Status = 'idle' | 'valid' | 'error'
type Indent = 2 | 4 | 'tab'

function parseLineCol(message: string): string {
  // Chrome/Node: "Unexpected token ... at line L column C"
  const lineCol = message.match(/line (\d+) column (\d+)/i)
  if (lineCol) return `Line ${lineCol[1]}, Col ${lineCol[2]}: `
  // Firefox style: "at line N col N"
  const pos = message.match(/at line (\d+) col(?:umn)? (\d+)/i)
  if (pos) return `Line ${pos[1]}, Col ${pos[2]}: `
  return ''
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value as object).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key])
    }
    return sorted
  }
  return value
}

function toIndentArg(indent: Indent): string | number {
  return indent === 'tab' ? '\t' : indent
}

function formatJSON(
  raw: string,
  indent: Indent,
  sort: boolean,
): { result: string; status: Status; error?: string } {
  if (!raw.trim()) return { result: '', status: 'idle' }
  try {
    let parsed = JSON.parse(raw)
    if (sort) parsed = sortKeysDeep(parsed)
    return { result: JSON.stringify(parsed, null, toIndentArg(indent)), status: 'valid' }
  } catch (e) {
    const msg = (e as Error).message
    return { result: '', status: 'error', error: parseLineCol(msg) + msg }
  }
}

function minifyJSON(raw: string): { result: string; status: Status; error?: string } {
  if (!raw.trim()) return { result: '', status: 'idle' }
  try {
    const parsed = JSON.parse(raw)
    return { result: JSON.stringify(parsed), status: 'valid' }
  } catch (e) {
    const msg = (e as Error).message
    return { result: '', status: 'error', error: parseLineCol(msg) + msg }
  }
}

export default function App() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [indent, setIndent] = useState<Indent>(2)
  const [sortKeys, setSortKeys] = useState(false)
  const [viewTab, setViewTab] = useState<'code' | 'tree' | 'convert'>('code')
  const { entries: historyEntries, push: pushHistory, remove: removeHistory, clear: clearHistory } = useHistory()

  const parsedJson = useMemo(() => {
    if (!input.trim()) return null
    try { return JSON.parse(input) } catch { return null }
  }, [input])

  const handleFormat = useCallback(() => {
    const { result, status, error } = formatJSON(input, indent, sortKeys)
    setOutput(result)
    setStatus(status)
    setError(error ?? '')
    if (result) pushHistory(input)
  }, [input, indent, sortKeys, pushHistory])

  const handleMinify = useCallback(() => {
    const { result, status, error } = minifyJSON(input)
    setOutput(result)
    setStatus(status)
    setError(error ?? '')
  }, [input])

  const handleCopy = useCallback(() => {
    if (!output) return
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [output])

  const handleRepair = useCallback(() => {
    if (!input.trim()) return
    try {
      const repaired = jsonrepair(input)
      setInput(repaired)
      setStatus('idle')
      setError('')
    } catch (e) {
      setStatus('error')
      setError((e as Error).message)
    }
  }, [input])

  const handleClear = useCallback(() => {
    setInput('')
    setOutput('')
    setStatus('idle')
    setError('')
  }, [])

  const statusColor =
    status === 'valid' ? 'text-success' :
    status === 'error' ? 'text-danger' :
    'text-text-muted'

  const statusLabel =
    status === 'valid' ? '✓ Valid JSON' :
    status === 'error' ? `✗ ${error}` :
    'Paste JSON and click Format or Minify'

  const indentOptions: { label: string; value: Indent }[] = [
    { label: '2', value: 2 },
    { label: '4', value: 4 },
    { label: 'Tab', value: 'tab' },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary" onClick={handleFormat}>Format</button>
          <button className="btn-secondary" onClick={handleMinify}>Minify</button>
          <button
            className="btn-secondary"
            onClick={handleRepair}
            disabled={!input.trim()}
            title="Auto-fix trailing commas, single quotes, missing quotes on keys"
          >
            Repair
          </button>

          {/* Indent */}
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-text-muted text-xs">Indent:</span>
            {indentOptions.map(({ label, value }) => (
              <button
                key={label}
                onClick={() => setIndent(value)}
                className={`btn text-xs px-2 py-1 ${indent === value ? 'bg-accent text-surface-900' : 'bg-surface-700 text-text-secondary border border-surface-600 hover:bg-surface-600'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sort Keys */}
          <button
            onClick={() => setSortKeys(s => !s)}
            title="Sort object keys alphabetically"
            className={`btn text-xs px-2 py-1 ml-1 ${sortKeys ? 'bg-accent text-surface-900' : 'bg-surface-700 text-text-secondary border border-surface-600 hover:bg-surface-600'}`}
          >
            Sort Keys
          </button>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-auto">
            <HistoryDropdown
              entries={historyEntries}
              onRestore={(content) => { setInput(content); setOutput(''); setStatus('idle'); setError('') }}
              onRemove={removeHistory}
              onClearAll={clearHistory}
            />
            <button className="btn-danger" onClick={handleClear}>Clear</button>
          </div>
        </div>

        {/* Status */}
        <p className={`text-xs font-mono ${statusColor} min-h-[1rem]`}>{statusLabel}</p>

        {/* Editor panes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-text-muted text-xs uppercase tracking-wider">Input</label>
            <div className="flex-1 min-h-[500px] rounded-lg overflow-hidden border border-surface-700 focus-within:border-accent/50">
              <CodeEditor value={input} onChange={setInput} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            {/* View tab bar */}
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {([['code', 'Code'], ['tree', 'Tree'], ['convert', 'Convert']] as const).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setViewTab(id)}
                    className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                      viewTab === id
                        ? 'bg-surface-700 text-text-primary border border-surface-600'
                        : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {viewTab === 'code' && (
                <button
                  className="btn-secondary text-xs ml-auto"
                  onClick={handleCopy}
                  disabled={!output}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              )}
              {viewTab === 'tree' && <span className="ml-auto" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-h-[500px] rounded-lg overflow-hidden border border-surface-700 flex flex-col bg-surface-800">
              {viewTab === 'code' && <OutputEditor value={output} />}
              {viewTab === 'tree' && (
                <div className="flex-1 flex flex-col p-3 min-h-0">
                  <TreeView data={parsedJson} />
                </div>
              )}
              {viewTab === 'convert' && (
                <div className="flex-1 flex flex-col p-3 min-h-0">
                  <ConvertPanel data={parsedJson} />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
