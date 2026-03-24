import { useState, useCallback } from 'react'
import { Header } from './components/Header'

type Status = 'idle' | 'valid' | 'error'

function formatJSON(raw: string, indent: number): { result: string; status: Status; error?: string } {
  if (!raw.trim()) return { result: '', status: 'idle' }
  try {
    const parsed = JSON.parse(raw)
    return { result: JSON.stringify(parsed, null, indent), status: 'valid' }
  } catch (e) {
    return { result: '', status: 'error', error: (e as Error).message }
  }
}

function minifyJSON(raw: string): { result: string; status: Status; error?: string } {
  if (!raw.trim()) return { result: '', status: 'idle' }
  try {
    const parsed = JSON.parse(raw)
    return { result: JSON.stringify(parsed), status: 'valid' }
  } catch (e) {
    return { result: '', status: 'error', error: (e as Error).message }
  }
}

export default function App() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [indent, setIndent] = useState(2)

  const handleFormat = useCallback(() => {
    const { result, status, error } = formatJSON(input, indent)
    setOutput(result)
    setStatus(status)
    setError(error ?? '')
  }, [input, indent])

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
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary" onClick={handleFormat}>Format</button>
          <button className="btn-secondary" onClick={handleMinify}>Minify</button>

          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-text-muted text-xs">Indent:</span>
            {[2, 4].map(n => (
              <button
                key={n}
                onClick={() => setIndent(n)}
                className={`btn text-xs px-2 py-1 ${indent === n ? 'bg-accent text-surface-900' : 'bg-surface-700 text-text-secondary border border-surface-600 hover:bg-surface-600'}`}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              className="btn-secondary"
              onClick={handleCopy}
              disabled={!output}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button className="btn-danger" onClick={handleClear}>Clear</button>
          </div>
        </div>

        {/* Status */}
        <p className={`text-xs ${statusColor} min-h-[1rem]`}>{statusLabel}</p>

        {/* Editor panes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-text-muted text-xs uppercase tracking-wider">Input</label>
            <textarea
              className="flex-1 min-h-[400px] bg-surface-800 border border-surface-700 rounded-lg p-3
                         font-mono text-sm text-text-primary placeholder-text-muted
                         focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent
                         resize-none"
              placeholder='{"key": "value"}'
              value={input}
              onChange={e => setInput(e.target.value)}
              spellCheck={false}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-text-muted text-xs uppercase tracking-wider">Output</label>
            <textarea
              className="flex-1 min-h-[400px] bg-surface-800 border border-surface-700 rounded-lg p-3
                         font-mono text-sm text-text-primary
                         focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent
                         resize-none"
              readOnly
              value={output}
              spellCheck={false}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
