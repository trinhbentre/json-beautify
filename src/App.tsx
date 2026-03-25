import { useState, useCallback, useMemo } from 'react'
import { jsonrepair } from 'jsonrepair'
import { Header } from './components/Header'
import { CodeEditor } from './components/CodeEditor'
import { OutputEditor } from './components/OutputEditor'
import { TreeView } from './components/TreeView'
import { ConvertPanel } from './components/ConvertPanel'
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

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-surface-900">
      <Header
        indent={indent}
        onIndentChange={setIndent}
        sortKeys={sortKeys}
        onToggleSortKeys={() => setSortKeys(s => !s)}
        onFormat={handleFormat}
        onMinify={handleMinify}
        onRepair={handleRepair}
        repairDisabled={!input.trim()}
        onClear={handleClear}
        historyEntries={historyEntries}
        onRestore={(content) => { setInput(content); setOutput(''); setStatus('idle'); setError('') }}
        onRemove={removeHistory}
        onClearHistory={clearHistory}
      />

      <main className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 divide-x divide-surface-700">
        {/* Left — Input pane */}
        <div className="flex flex-col overflow-hidden h-[50vh] lg:h-auto">
          <div className="pane-header">
            <span className="text-text-muted font-semibold tracking-widest uppercase text-[10px]">Input</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <CodeEditor value={input} onChange={setInput} />
          </div>
          <div className="status-bar">
            <span className={statusColor}>{statusLabel}</span>
            <span className="text-text-muted ml-auto">{input.length.toLocaleString()} chars</span>
          </div>
        </div>

        {/* Right — Output pane */}
        <div className="flex flex-col overflow-hidden h-[50vh] lg:h-auto">
          <div className="pane-header">
            <div className="flex gap-0.5 border-r border-surface-700 pr-2 mr-1">
              {([['code', 'Code'], ['tree', 'Tree'], ['convert', 'Convert']] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setViewTab(id)}
                  className={`text-xs px-2.5 py-0.5 rounded font-medium transition-colors ${
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
                className="btn-secondary ml-auto"
                onClick={handleCopy}
                disabled={!output}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            )}
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            {viewTab === 'code' && <OutputEditor value={output} />}
            {viewTab === 'tree' && (
              <div className="h-full overflow-y-auto p-3">
                <TreeView data={parsedJson} />
              </div>
            )}
            {viewTab === 'convert' && (
              <div className="h-full overflow-hidden p-3 flex flex-col">
                <ConvertPanel data={parsedJson} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
