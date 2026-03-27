import { useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

interface VirtualTextViewerProps {
  text: string
}

// Simple syntax coloring for JSON using token-based regex
const TOKEN_RE = /("(?:[^"\\]|\\.)*")|(\btrue\b|\bfalse\b)|(\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([:,[\]{}])/g

function colorLine(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null

  TOKEN_RE.lastIndex = 0
  while ((match = TOKEN_RE.exec(line)) !== null) {
    if (match.index > last) {
      parts.push(<span key={last}>{line.slice(last, match.index)}</span>)
    }
    const [full, str, bool, nil, num] = match
    if (str != null) {
      // Determine if string is a key (followed by :) or value
      const after = line.slice(match.index + full.length).trimStart()
      const isKey = after.startsWith(':')
      parts.push(
        <span key={match.index} className={isKey ? 'text-text-secondary' : 'text-accent'}>
          {full}
        </span>,
      )
    } else if (bool != null) {
      parts.push(<span key={match.index} className="text-warning">{full}</span>)
    } else if (nil != null) {
      parts.push(<span key={match.index} className="text-danger/60">{full}</span>)
    } else if (num != null) {
      parts.push(<span key={match.index} className="text-success">{full}</span>)
    } else {
      parts.push(<span key={match.index} className="text-text-muted">{full}</span>)
    }
    last = match.index + full.length
  }
  if (last < line.length) {
    parts.push(<span key={last}>{line.slice(last)}</span>)
  }
  return parts
}

export function VirtualTextViewer({ text }: VirtualTextViewerProps) {
  const lines = useMemo(() => text.split('\n'), [text])
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 20,
    overscan: 30,
  })

  const lineNumWidth = String(lines.length).length

  return (
    <div
      ref={parentRef}
      className="h-full overflow-auto bg-surface-900 font-mono text-sm"
    >
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualRow => {
          const line = lines[virtualRow.index]
          const lineNum = virtualRow.index + 1
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="flex items-start hover:bg-surface-800/60"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <span
                className="text-text-muted/40 text-right pr-4 pl-2 shrink-0 select-none tabular-nums"
                style={{ minWidth: `${lineNumWidth + 3}ch` }}
              >
                {lineNum}
              </span>
              <span className="text-text-primary whitespace-pre flex-1 pr-2">
                {colorLine(line)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
