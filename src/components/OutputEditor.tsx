import MonacoEditor from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

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
  },
}

interface OutputEditorProps {
  value: string
  language?: string
}

export function OutputEditor({ value, language = 'json' }: OutputEditorProps) {
  function handleBeforeMount(monaco: typeof import('monaco-editor')) {
    monaco.editor.defineTheme('web-tools-dark', THEME_OPTIONS)
  }

  return (
    <MonacoEditor
      height="100%"
      language={language}
      theme="web-tools-dark"
      value={value}
      beforeMount={handleBeforeMount}
      options={{
        fontSize: 13,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        lineNumbers: 'on',
        renderLineHighlight: 'line',
        readOnly: true,
        automaticLayout: true,
        padding: { top: 12, bottom: 12 },
        domReadOnly: true,
      }}
    />
  )
}
