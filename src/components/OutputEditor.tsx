import MonacoEditor from '@monaco-editor/react'
import { MONACO_THEME, MONO_FONT } from '../lib/monacoTheme'

interface OutputEditorProps {
  value: string
  language?: string
}

export function OutputEditor({ value, language = 'json' }: OutputEditorProps) {
  function handleBeforeMount(monaco: typeof import('monaco-editor')) {
    monaco.editor.defineTheme('web-tools-dark', MONACO_THEME)
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
        fontFamily: MONO_FONT,
        fontLigatures: true,
        letterSpacing: 0.3,
        lineHeight: 1.6,
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
