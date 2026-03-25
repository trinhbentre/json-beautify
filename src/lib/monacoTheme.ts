import type { editor } from 'monaco-editor'

export const MONACO_THEME: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'string.key.json',   foreground: 'e3b341' }, // amber gold  — keys
    { token: 'string.value.json', foreground: 'a5d6ff' }, // light blue  — string values
    { token: 'number',            foreground: '79c0ff' }, // accent blue — numbers
    { token: 'keyword.json',      foreground: 'ff7b72' }, // red         — true/false/null
    { token: 'delimiter',         foreground: '8b949e' }, // muted gray  — : , { } [ ]
  ],
  colors: {
    'editor.background':                 '#0d1117',
    'editor.lineHighlightBackground':    '#161b22',
    'editorLineNumber.foreground':       '#484f58',
    'editorLineNumber.activeForeground': '#8b949e',
    'editor.selectionBackground':        '#264f78',
    'editorCursor.foreground':           '#58a6ff',
    'editorBracketHighlight.foreground1':'#e3b341',
    'editorBracketHighlight.foreground2':'#79c0ff',
    'editorBracketHighlight.foreground3':'#ff7b72',
  },
}

export const MONO_FONT = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
