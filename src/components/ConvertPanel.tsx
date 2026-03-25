import { useState } from 'react'
import jsYaml from 'js-yaml'
import { OutputEditor } from './OutputEditor'

type ConvertTab = 'yaml' | 'typescript' | 'csv'

// ── TypeScript Interface generator ─────────────────────────────────────────

function toPascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function inferType(value: unknown, name: string, interfaces: Map<string, string>): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (Array.isArray(value)) {
    if (value.length === 0) return 'unknown[]'
    const base = name.endsWith('s') ? name.slice(0, -1) : name
    const itemType = inferType(value[0], toPascalCase(base) + 'Item', interfaces)
    return `${itemType}[]`
  }
  if (typeof value === 'object') {
    const interfaceName = toPascalCase(name)
    const lines: string[] = [`interface ${interfaceName} {`]
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const fieldType = inferType(val, toPascalCase(key), interfaces)
      lines.push(`  ${key}: ${fieldType};`)
    }
    lines.push('}')
    interfaces.set(interfaceName, lines.join('\n'))
    return interfaceName
  }
  return 'unknown'
}

function jsonToTypeScript(value: unknown): string {
  if (value === null) return '// Cannot generate interface for null'
  if (typeof value !== 'object') return `// Cannot generate interface for primitive value`
  const interfaces = new Map<string, string>()
  if (Array.isArray(value)) {
    if (value.length === 0) return 'type Root = unknown[]'
    inferType(value[0], 'Item', interfaces)
    return Array.from(interfaces.values()).join('\n\n') + '\n\ntype Root = Item[]'
  }
  inferType(value, 'Root', interfaces)
  return Array.from(interfaces.values()).join('\n\n')
}

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

  const yamlOutput = (() => {
    if (data === null || data === undefined) return ''
    try { return jsYaml.dump(data, { lineWidth: -1 }) } catch { return '' }
  })()

  const tsOutput = data !== null && data !== undefined ? jsonToTypeScript(data) : ''

  const csvResult = jsonToCSV(data)

  const tabs: { id: ConvertTab; label: string }[] = [
    { id: 'yaml', label: 'YAML' },
    { id: 'typescript', label: 'TypeScript' },
    { id: 'csv', label: 'CSV' },
  ]

  function handleDownload() {
    if (tab === 'yaml') downloadFile(yamlOutput, 'output.yaml', 'text/yaml')
    else if (tab === 'typescript') downloadFile(tsOutput, 'output.ts', 'text/typescript')
    else if (tab === 'csv' && csvResult.csv) downloadFile(csvResult.csv, 'output.csv', 'text/csv')
  }

  const hasContent =
    tab === 'yaml' ? !!yamlOutput :
    tab === 'typescript' ? !!tsOutput :
    !!csvResult.csv

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Sub-tabs + Download */}
      <div className="flex items-center gap-1.5">
        <div className="flex gap-0.5">
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
        <button
          className="btn-secondary text-xs ml-auto"
          onClick={handleDownload}
          disabled={!hasContent}
        >
          ↓ Download
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 rounded overflow-hidden">
        {tab === 'yaml' && (
          data !== null && data !== undefined
            ? <OutputEditor value={yamlOutput} language="yaml" />
            : <p className="flex items-center justify-center h-full text-text-muted text-sm">No valid JSON to convert</p>
        )}
        {tab === 'typescript' && (
          data !== null && data !== undefined
            ? <OutputEditor value={tsOutput} language="typescript" />
            : <p className="flex items-center justify-center h-full text-text-muted text-sm">No valid JSON to convert</p>
        )}
        {tab === 'csv' && (
          csvResult.error
            ? <p className="flex items-center justify-center h-full text-text-muted text-sm">{csvResult.error}</p>
            : <OutputEditor value={csvResult.csv} language="plaintext" />
        )}
      </div>
    </div>
  )
}
