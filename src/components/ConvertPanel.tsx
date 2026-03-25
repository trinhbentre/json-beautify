import { useState, useMemo } from 'react'
import jsYaml from 'js-yaml'
import { OutputEditor } from './OutputEditor'
import { generateTypeScript, generateGo, generateJava, generateCSharp } from '../lib/modelGenerators'

type ConvertTab = 'yaml' | 'typescript' | 'csv' | 'go' | 'java' | 'csharp'

// ── CSV generator ───────────────────────────────────────────────────────────

function csvCell(val: unknown): string {
  if (val === null || val === undefined) return ''
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

function jsonToCSV(value: unknown): { csv: string; error?: string } {
  if (!Array.isArray(value)) return { csv: '', error: 'CSV export requires an array of objects' }
  if (value.length === 0) return { csv: '', error: 'Array is empty' }
  const first = value[0]
  if (typeof first !== 'object' || first === null) {
    return { csv: '', error: 'CSV export requires an array of objects (not primitives)' }
  }
  const keys = Object.keys(first as object)
  const header = keys.map(k => csvCell(k)).join(',')
  const rows = (value as Record<string, unknown>[]).map(item =>
    keys.map(k => csvCell(item[k])).join(',')
  )
  return { csv: [header, ...rows].join('\n') }
}

// ── Download helper ─────────────────────────────────────────────────────────

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Component ───────────────────────────────────────────────────────────────

interface ConvertPanelProps {
  data: unknown
}

export function ConvertPanel({ data }: ConvertPanelProps) {
  const [tab, setTab] = useState<ConvertTab>('yaml')
  const [bsonTags, setBsonTags] = useState(false)
  const [copied, setCopied] = useState(false)

  const hasData = data !== null && data !== undefined

  const yamlOutput = useMemo(() => {
    if (!hasData) return ''
    try { return jsYaml.dump(data, { lineWidth: -1 }) } catch { return '' }
  }, [data, hasData])

  const tsOutput = useMemo(() => hasData ? generateTypeScript(data) : '', [data, hasData])

  const csvResult = useMemo(() => jsonToCSV(data), [data])

  const goOutput = useMemo(() => hasData ? generateGo(data, 'Root', { bsonTags }) : '', [data, hasData, bsonTags])
  const javaOutput = useMemo(() => hasData ? generateJava(data, 'Root') : '', [data, hasData])
  const csharpOutput = useMemo(() => hasData ? generateCSharp(data, 'Root') : '', [data, hasData])

  const tabs: { id: ConvertTab; label: string }[] = [
    { id: 'yaml', label: 'YAML' },
    { id: 'typescript', label: 'TypeScript' },
    { id: 'csv', label: 'CSV' },
    { id: 'go', label: 'Go' },
    { id: 'java', label: 'Java' },
    { id: 'csharp', label: 'C#' },
  ]

  function getCurrentContent(): string {
    if (tab === 'yaml') return yamlOutput
    if (tab === 'typescript') return tsOutput
    if (tab === 'csv') return csvResult.csv
    if (tab === 'go') return goOutput
    if (tab === 'java') return javaOutput
    if (tab === 'csharp') return csharpOutput
    return ''
  }

  function handleDownload() {
    if (tab === 'yaml') downloadFile(yamlOutput, 'output.yaml', 'text/yaml')
    else if (tab === 'typescript') downloadFile(tsOutput, 'output.ts', 'text/typescript')
    else if (tab === 'csv' && csvResult.csv) downloadFile(csvResult.csv, 'output.csv', 'text/csv')
    else if (tab === 'go') downloadFile(goOutput, 'output.go', 'text/plain')
    else if (tab === 'java') downloadFile(javaOutput, 'Root.java', 'text/plain')
    else if (tab === 'csharp') downloadFile(csharpOutput, 'Root.cs', 'text/plain')
  }

  function handleCopy() {
    const content = getCurrentContent()
    if (!content) return
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const hasContent = !!getCurrentContent()
  const isModelTab = tab === 'go' || tab === 'java' || tab === 'csharp' || tab === 'typescript'

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="flex gap-0.5 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                tab === t.id
                  ? 'bg-surface-600 text-text-primary border border-surface-500'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          {tab === 'go' && (
            <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={bsonTags}
                onChange={e => setBsonTags(e.target.checked)}
                className="accent-accent"
              />
              BSON tags
            </label>
          )}
          {isModelTab && (
            <button
              className="btn-secondary text-xs"
              onClick={handleCopy}
              disabled={!hasContent}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          )}
          <button
            className="btn-secondary text-xs"
            onClick={handleDownload}
            disabled={!hasContent}
          >
            ↓ Download
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 rounded overflow-hidden">
        {tab === 'yaml' && (
          hasData
            ? <OutputEditor value={yamlOutput} language="yaml" />
            : <p className="flex items-center justify-center h-full text-text-muted text-sm">No valid JSON to convert</p>
        )}
        {tab === 'typescript' && (
          hasData
            ? <OutputEditor value={tsOutput} language="typescript" />
            : <p className="flex items-center justify-center h-full text-text-muted text-sm">No valid JSON to convert</p>
        )}
        {tab === 'csv' && (
          csvResult.error
            ? <p className="flex items-center justify-center h-full text-text-muted text-sm">{csvResult.error}</p>
            : <OutputEditor value={csvResult.csv} language="plaintext" />
        )}
        {tab === 'go' && (
          hasData
            ? <OutputEditor value={goOutput} language="plaintext" />
            : <p className="flex items-center justify-center h-full text-text-muted text-sm">No valid JSON to convert</p>
        )}
        {tab === 'java' && (
          hasData
            ? <OutputEditor value={javaOutput} language="plaintext" />
            : <p className="flex items-center justify-center h-full text-text-muted text-sm">No valid JSON to convert</p>
        )}
        {tab === 'csharp' && (
          hasData
            ? <OutputEditor value={csharpOutput} language="plaintext" />
            : <p className="flex items-center justify-center h-full text-text-muted text-sm">No valid JSON to convert</p>
        )}
      </div>
    </div>
  )
}
