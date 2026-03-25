import MonacoEditor from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useRef } from 'react'

// Match surface-800 (#161b22) background from tailwind theme
const THEME_OPTIONS: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#161b22',
    'editor.lineHighlightBackground': '#21262d',
    'editorLineNumber.foreground': '#484f58',
    'editorLineNumber.activeForeground': '#8b949e',
    'editor.selectionBackground': '#264f78',
    'editorCursor.foreground': '#58a6ff',
  },
}

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
}

export function CodeEditor({ value, onChange }: CodeEditorProps) {
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null)

  function handleBeforeMount(monaco: typeof import('monaco-editor')) {
    monacoRef.current = monaco
    monaco.editor.defineTheme('web-tools-dark', THEME_OPTIONS)
  }

  return (
    <MonacoEditor
      height="100%"
      language="json"
      theme="web-tools-dark"
      value={value}
      beforeMount={handleBeforeMount}
      onChange={v => onChange(v ?? '')}
      options={{
        fontSize: 13,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        lineNumbers: 'on',
        renderLineHighlight: 'line',
        tabSize: 2,
        automaticLayout: true,
        padding: { top: 12, bottom: 12 },
      }}
    />
  )
}
