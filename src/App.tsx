import { useState, useCallback, useMemo } from 'react'
import { jsonrepair } from 'jsonrepair'
import { Header } from './components/Header'
import { CodeEditor } from './components/CodeEditor'
import { OutputEditor } from './components/OutputEditor'
import { VirtualTextViewer } from './components/VirtualTextViewer'
import { TreeView } from './components/TreeView'
import { ConvertPanel } from './components/ConvertPanel'
import { TableView } from './components/TableView'
import { DiagramView } from './components/DiagramView'
import { FileDropZone } from './components/FileDropZone'
import { ParseProgress } from './components/ParseProgress'
import { JQSearchPanel } from './components/JQSearchPanel'
import { useHistory } from './hooks/useHistory'
import * as parserService from './lib/parserService'
import type { ParseResult } from './lib/parserService'

type Status = 'idle' | 'valid' | 'error'
type Indent = 2 | 4 | 'tab'

const LARGE_CODE_THRESHOLD = 20 * 1024 * 1024 // 20MB

interface JsonError {
  location: string
  friendly: string
  hint?: string
}

function parseJsonError(message: string): JsonError {
  const lineCol = message.match(/line (\d+) column (\d+)/i)
  const atPos = message.match(/at line (\d+) col(?:umn)? (\d+)/i)
  const location = lineCol
    ? `Line ${lineCol[1]}, Col ${lineCol[2]}`
    : atPos ? `Line ${atPos[1]}, Col ${atPos[2]}` : ''

  if (/unexpected end of json input/i.test(message))
    return { location, friendly: 'JSON is incomplete — looks like it was cut off', hint: 'Check that you copied the full content' }
  if (/property name/i.test(message))
    return { location, friendly: 'Property names must be wrapped in double quotes', hint: 'Try Repair to auto-fix unquoted keys' }
  if (/unexpected token ','|Expected.*after.*value/i.test(message))
    return { location, friendly: 'Trailing comma — the last item in an object or array cannot end with a comma', hint: 'Try Repair to remove it automatically' }
  if (/unexpected token/i.test(message)) {
    const tok = message.match(/Unexpected token '?([^'\s]+)'?/i)
    const charPart = tok ? ` '${tok[1]}'` : ''
    return { location, friendly: `Unexpected character${charPart} in JSON`, hint: 'Common causes: trailing commas, unquoted property names, or single quotes' }
  }
  return { location, friendly: message, hint: undefined }
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
    return { result: '', status: 'error', error: msg }
  }
}

function minifyJSON(raw: string): { result: string; status: Status; error?: string } {
  if (!raw.trim()) return { result: '', status: 'idle' }
  try {
    const parsed = JSON.parse(raw)
    return { result: JSON.stringify(parsed), status: 'valid' }
  } catch (e) {
    const msg = (e as Error).message
    return { result: '', status: 'error', error: msg }
  }
}

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default function App() {
  // Text mode state
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [indent, setIndent] = useState<Indent>(2)
  const [sortKeys, setSortKeys] = useState(false)
  const [viewTab, setViewTab] = useState<'code' | 'tree' | 'table' | 'diagram' | 'convert'>('code')

  // File mode state
  const [fileMode, setFileMode] = useState(false)
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parsePercent, setParsePercent] = useState(0)
  const [parseBytesRead, setParseBytesRead] = useState(0)
  const [parseStartTime, setParseStartTime] = useState(0)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  const { entries: historyEntries, push: pushHistory, remove: removeHistory, clear: clearHistory } = useHistory()

  // parsedJson for Tree/Convert — works in both modes
  const parsedJson = useMemo(() => {
    if (fileMode && parseResult) return parseResult.root
    if (!input.trim()) return null
    try { return JSON.parse(input) } catch { return null }
  }, [fileMode, parseResult, input])

  // Code output for file mode (skip if too large for Monaco)
  const fileCodeOutput = useMemo(() => {
    if (!fileMode || !parseResult) return ''
    if (parseResult.sizeBytes > LARGE_CODE_THRESHOLD) return null // null = too large
    try {
      return JSON.stringify(parseResult.root, null, toIndentArg(indent))
    } catch {
      return ''
    }
  }, [fileMode, parseResult, indent])

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
    const toCopy = fileMode ? fileCodeOutput ?? '' : output
    if (!toCopy) return
    navigator.clipboard.writeText(toCopy).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [fileMode, fileCodeOutput, output])

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
    if (fileMode) {
      setFileMode(false)
      setFileInfo(null)
      setParseResult(null)
      setParseError(null)
    }
    setInput('')
    setOutput('')
    setStatus('idle')
    setError('')
  }, [fileMode])

  const handleOpenFile = useCallback(async (file: File) => {
    setFileMode(true)
    setFileInfo({ name: file.name, size: file.size })
    setParsing(true)
    setParsePercent(0)
    setParseBytesRead(0)
    setParseStartTime(Date.now())
    setParseResult(null)
    setParseError(null)
    setStatus('idle')
    try {
      const result = await parserService.parseFile(file, (percent, bytesRead) => {
        setParsePercent(percent)
        setParseBytesRead(bytesRead)
      })
      setParseResult(result)
      setStatus('valid')
    } catch (e) {
      if ((e as Error).message !== 'Aborted') {
        setParseError((e as Error).message)
        setStatus('error')
      }
    } finally {
      setParsing(false)
    }
  }, [])

  const handleLoadUrl = useCallback(async (url: string) => {
    setFileMode(true)
    setFileInfo(null)
    setParsing(true)
    setParsePercent(0)
    setParseBytesRead(0)
    setParseStartTime(Date.now())
    setParseResult(null)
    setParseError(null)
    setStatus('idle')
    try {
      const result = await parserService.parseUrl(url, (percent, bytesRead) => {
        setParsePercent(percent)
        setParseBytesRead(bytesRead)
      })
      setParseResult(result)
      try {
        const urlPath = new URL(url).pathname
        const name = urlPath.split('/').pop() || 'data.json'
        setFileInfo({ name, size: result.sizeBytes })
      } catch {
        setFileInfo({ name: 'data.json', size: result.sizeBytes })
      }
      setStatus('valid')
    } catch (e) {
      if ((e as Error).message !== 'Aborted') {
        setParseError((e as Error).message)
        setStatus('error')
      }
    } finally {
      setParsing(false)
    }
  }, [])

  const handleCancelParse = useCallback(() => {
    parserService.abortAll()
    setParsing(false)
    setFileMode(false)
    setFileInfo(null)
  }, [])

  // Status bar output
  const statusColor =
    status === 'valid' ? 'text-success' :
    status === 'error' ? 'text-danger' :
    'text-text-muted'

  const jsonError = !fileMode && status === 'error' && error ? parseJsonError(error) : null

  const statusLabel = fileMode
    ? status === 'valid' && parseResult
      ? `✓ ${parseResult.nodeCount.toLocaleString()} nodes · parsed in ${parseResult.parseTimeMs.toFixed(0)}ms`
      : status === 'error'
        ? `✗ ${parseError}`
        : 'Loading…'
    : status === 'valid' ? '✓ Valid JSON'
    : status === 'error' ? `✗ ${jsonError?.location || 'Syntax error'}`
    : 'Paste JSON and click Format or Minify'

  const codeOutput = fileMode ? (fileCodeOutput ?? '') : output
  const canCopy = fileMode ? (fileCodeOutput != null && fileCodeOutput !== '') : !!output

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
        repairDisabled={fileMode || !input.trim()}
        onClear={handleClear}
        historyEntries={historyEntries}
        onRestore={(content) => {
          setFileMode(false)
          setFileInfo(null)
          setParseResult(null)
          setParseError(null)
          setInput(content)
          setOutput('')
          setStatus('idle')
          setError('')
        }}
        onRemove={removeHistory}
        onClearHistory={clearHistory}
        onOpenFile={handleOpenFile}
        onLoadUrl={handleLoadUrl}
      />

      {/* Parse progress bar */}
      {parsing && (
        <ParseProgress
          percent={parsePercent}
          bytesRead={parseBytesRead}
          elapsedMs={Date.now() - parseStartTime}
          onCancel={handleCancelParse}
        />
      )}

      <main className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 divide-x divide-surface-700">
        {/* Left — Input pane */}
        <div className="flex flex-col overflow-hidden h-[50vh] lg:h-auto">
          <div className="pane-header">
            <span className="text-text-muted font-semibold tracking-widest uppercase text-[10px]">Input</span>
            {fileMode && (
              <button
                className="ml-auto text-xs text-text-muted hover:text-text-secondary"
                onClick={handleClear}
                title="Close file — back to text mode"
              >
                ✕ Close file
              </button>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            {fileMode ? (
              <FileDropZone onFile={handleOpenFile} onUrl={handleLoadUrl} fileInfo={fileInfo} />
            ) : (
              <CodeEditor value={input} onChange={setInput} />
            )}
          </div>
          {jsonError && (
            <div className="shrink-0 border-t border-danger/30 bg-danger/8 px-3 py-2 flex flex-col gap-1">
              <p className="text-xs text-danger font-medium">{jsonError.friendly}</p>
              {jsonError.hint && (
                <p className="text-xs text-warning/80">💡 {jsonError.hint}</p>
              )}
            </div>
          )}
          <div className="status-bar">
            <span className={statusColor}>{statusLabel}</span>
            {!fileMode && (
              <span className="text-text-muted ml-auto">{input.length.toLocaleString()} chars</span>
            )}
            {fileMode && fileInfo && (
              <span className="text-text-muted ml-auto">{formatBytes(fileInfo.size)}</span>
            )}
          </div>
        </div>

        {/* Right — Output pane */}
        <div className="flex flex-col overflow-hidden h-[50vh] lg:h-auto">
          <div className="pane-header">
            <div className="flex gap-0.5 border-r border-surface-700 pr-2 mr-1">
              {([['code', 'Code'], ['tree', 'Tree'], ['table', 'Table'], ['diagram', 'Diagram'], ['convert', 'Convert']] as const).map(([id, label]) => (
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
                disabled={!canCopy}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            )}
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            {viewTab === 'code' && (
              fileMode && fileCodeOutput === null ? (
                <div className="h-full flex items-center justify-center text-text-muted text-sm p-6 text-center">
                  <div>
                    <p className="text-base font-medium mb-1">File too large for code view</p>
                    <p className="text-xs opacity-70">Switch to <strong>Tree</strong> or <strong>Convert</strong> tab to inspect this file.</p>
                  </div>
                </div>
              ) : fileMode && parseResult && parseResult.sizeBytes > LARGE_CODE_THRESHOLD / 2 ? (
                <VirtualTextViewer text={codeOutput} />
              ) : (
                <OutputEditor value={codeOutput} />
              )
            )}
            {viewTab === 'tree' && (
              <div className="h-full overflow-hidden p-3 flex flex-col gap-3">
                <TreeView data={parsedJson} />
                <div className="shrink-0 border-t border-surface-700 pt-3">
                  <JQSearchPanel data={parsedJson} />
                </div>
              </div>
            )}
            {viewTab === 'table' && (
              <div className="h-full overflow-hidden flex flex-col">
                <TableView data={parsedJson} />
              </div>
            )}
            {viewTab === 'diagram' && (
              <div className="h-full overflow-hidden flex flex-col">
                <DiagramView data={parsedJson} />
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
