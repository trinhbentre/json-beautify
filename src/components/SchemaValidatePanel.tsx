import { useState, useEffect, useRef, useCallback } from 'react'
import { CodeEditor } from './CodeEditor'
import { validateJson } from '../lib/schemaValidator'
import type { ValidationError } from '../lib/schemaValidator'

const PLACEHOLDER_SCHEMA = `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object"
}`

interface SchemaValidatePanelProps {
  json: unknown
  onValidationChange: (paths: Set<string>) => void
}

export function SchemaValidatePanel({ json, onValidationChange }: SchemaValidatePanelProps) {
  const [schemaText, setSchemaText] = useState('')
  const [result, setResult] = useState<{ valid: boolean; errors: ValidationError[] } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runValidation = useCallback((text: string) => {
    if (!text.trim()) {
      setResult(null)
      onValidationChange(new Set())
      return
    }
    let schema: unknown
    try {
      schema = JSON.parse(text)
    } catch {
      setResult({ valid: false, errors: [{ path: '', message: 'Schema is not valid JSON', keyword: 'parse' }] })
      onValidationChange(new Set())
      return
    }
    const res = validateJson(schema, json)
    setResult(res)
    const paths = new Set(res.errors.map(e => e.path).filter(Boolean))
    onValidationChange(paths)
  }, [json, onValidationChange])

  // Auto-validate with debounce when schema text changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runValidation(schemaText)
    }, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [schemaText, runValidation])

  // Re-validate when json changes
  useEffect(() => {
    if (schemaText.trim()) runValidation(schemaText)
  }, [json, schemaText, runValidation])

  return (
    <div className="flex flex-col lg:flex-row h-full gap-3">
      {/* Left — Schema input */}
      <div className="flex flex-col flex-1 min-h-0 gap-2">
        <div className="flex items-center justify-between shrink-0">
          <span className="text-text-muted font-semibold tracking-widest uppercase text-[10px]">JSON Schema</span>
          <button
            className="btn-secondary text-xs"
            onClick={() => runValidation(schemaText)}
            disabled={!schemaText.trim()}
          >
            Validate
          </button>
        </div>
        <div className="flex-1 min-h-0 rounded overflow-hidden border border-surface-700/50">
          <CodeEditor
            value={schemaText}
            onChange={setSchemaText}
          />
        </div>
        {!schemaText.trim() && (
          <p className="text-text-muted text-xs shrink-0">
            Paste a JSON Schema above to validate. Placeholder: <code className="text-accent">{PLACEHOLDER_SCHEMA.split('\n')[0]}</code>…
          </p>
        )}
      </div>

      {/* Right — Results */}
      <div className="flex flex-col flex-1 min-h-0 gap-2">
        <span className="text-text-muted font-semibold tracking-widest uppercase text-[10px] shrink-0">Result</span>
        <div className="flex-1 min-h-0 rounded border border-surface-700/50 bg-surface-900/40 overflow-auto p-3">
          {result === null ? (
            <p className="text-text-muted text-sm italic">Paste a JSON Schema above to validate</p>
          ) : result.valid ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-success/15 text-success text-sm font-medium border border-success/30">
                ✓ Valid JSON
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-danger/15 text-danger text-sm font-medium border border-danger/30">
                  ✗ {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {result.errors.map((err, i) => (
                  <div key={i} className="rounded border border-surface-700 bg-surface-800 p-2.5 flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {err.path ? (
                        <code className="text-accent text-xs font-mono">{err.path}</code>
                      ) : (
                        <code className="text-text-muted text-xs font-mono">(root)</code>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700 text-text-secondary font-mono">
                        {err.keyword}
                      </span>
                    </div>
                    <p className="text-text-secondary text-xs">{err.message}</p>
                    {err.suggestion && (
                      <p className="text-warning text-xs">💡 {err.suggestion}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
