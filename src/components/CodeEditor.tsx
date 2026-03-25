import MonacoEditor from '@monaco-editor/react'
import { useRef } from 'react'
import { MONACO_THEME, MONO_FONT } from '../lib/monacoTheme'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
}

export function CodeEditor({ value, onChange }: CodeEditorProps) {
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null)

  function handleBeforeMount(monaco: typeof import('monaco-editor')) {
    monacoRef.current = monaco
    monaco.editor.defineTheme('web-tools-dark', MONACO_THEME)
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
        fontFamily: MONO_FONT,
        fontLigatures: true,
        letterSpacing: 0.3,
        lineHeight: 1.6,
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
