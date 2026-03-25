import { useState, useMemo } from 'react'
import { JSONPath } from 'jsonpath-plus'

function isImageUrl(val: string): boolean {
  return /^https?:\/\/.+\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(val)
}

function isHexColor(val: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val)
}

interface NodeProps {
  nodeKey: string | number | null
  value: unknown
  depth: number
  path: string
  highlightedPaths: Set<string>
}

function TreeNode({ nodeKey, value, depth, path, highlightedPaths }: NodeProps) {
  const isArr = Array.isArray(value)
  const isObj = !isArr && value !== null && typeof value === 'object'
  const isCollapsible = isArr || isObj
  const isHighlighted = path !== '' && highlightedPaths.has(path)
  const [open, setOpen] = useState(depth < 2)

  const pl = depth * 16

  const keyEl = nodeKey !== null ? (
    <span className="mr-1 shrink-0">
      {typeof nodeKey === 'number'
        ? <span className="text-text-muted">{nodeKey}</span>
        : <span className="text-text-secondary">"{nodeKey}"</span>
      }
      <span className="text-text-muted mx-1">:</span>
    </span>
  ) : null

  if (isCollapsible) {
    const entries = Object.entries(value as object)
    const count = entries.length
    const [ob, cb] = isArr ? ['[', ']'] : ['{', '}']

    if (count === 0) {
      return (
        <div
          className={`flex items-center gap-1 py-0.5 px-1 rounded ${
            isHighlighted ? 'bg-danger/15 border border-danger/30' : 'hover:bg-surface-700/40'
          }`}
          style={{ paddingLeft: `${pl}px` }}
        >
          <span className="w-3" />
          {keyEl}
          <span className="text-text-muted">{ob}{cb}</span>
        </div>
      )
    }

    return (
      <div>
        <button
          className={`w-full text-left flex items-center gap-1 py-0.5 px-1 rounded cursor-pointer ${
            isHighlighted ? 'bg-danger/15 border border-danger/30' : 'hover:bg-surface-700/40'
          }`}
          style={{ paddingLeft: `${pl}px` }}
          onClick={() => setOpen(v => !v)}
        >
          <span className="text-text-muted text-[10px] w-3 shrink-0 select-none">
            {open ? '▾' : '▸'}
          </span>
          {keyEl}
          <span className="text-text-muted">{ob}</span>
          {!open && (
            <>
              <span className="text-text-muted text-xs italic mx-1">
                {isArr ? `${count} items` : `${count} keys`}
              </span>
              <span className="text-text-muted">{cb}</span>
            </>
          )}
        </button>

        {open && (
          <>
            {entries.map(([k, v]) => {
              const childKey = isArr ? Number(k) : k
              const childPath = path === ''
                ? String(k)
                : isArr
                  ? `${path}[${k}]`
                  : `${path}.${k}`
              return (
                <TreeNode
                  key={k}
                  nodeKey={childKey}
                  value={v}
                  depth={depth + 1}
                  path={childPath}
                  highlightedPaths={highlightedPaths}
                />
              )
            })}
            <div
              className="py-0.5 px-1 text-text-muted"
              style={{ paddingLeft: `${(depth + 1) * 16}px` }}
            >
              {cb}
            </div>
          </>
        )}
      </div>
    )
  }

  // Primitives
  let valueEl: React.ReactNode

  if (value === null) {
    valueEl = <span className="text-danger/60 italic">null</span>
  } else if (typeof value === 'boolean') {
    valueEl = <span className="text-warning">{String(value)}</span>
  } else if (typeof value === 'number') {
    valueEl = <span className="text-success">{value}</span>
  } else {
    const s = value as string
    if (isHexColor(s)) {
      valueEl = (
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3.5 h-3.5 rounded-sm border border-white/20 shrink-0"
            style={{ backgroundColor: s }}
          />
          <span className="text-accent">"{s}"</span>
        </span>
      )
    } else if (isImageUrl(s)) {
      valueEl = (
        <span className="group/img relative inline-flex items-center">
          <span className="text-accent break-all">"{s}"</span>
          <img
            src={s}
            alt="preview"
            className="hidden group-hover/img:block absolute bottom-full left-0 mb-1 max-h-32 max-w-xs rounded border border-surface-600 bg-surface-800 shadow-xl z-20 pointer-events-none"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        </span>
      )
    } else {
      valueEl = <span className="text-accent break-all">"{s}"</span>
    }
  }

  return (
    <div
      className={`flex items-start gap-1 py-0.5 px-1 rounded ${
        isHighlighted ? 'bg-danger/15 border border-danger/30' : 'hover:bg-surface-700/40'
      }`}
      style={{ paddingLeft: `${pl + 16}px` }}
    >
      {keyEl}
      {valueEl}
    </div>
  )
}

interface TreeViewProps {
  data: unknown
  highlightedPaths?: Set<string>
}

export function TreeView({ data, highlightedPaths = new Set() }: TreeViewProps) {
  const [query, setQuery] = useState('')

  const { result: filteredResult, error: queryError } = useMemo(() => {
    const q = query.trim()
    if (!q || data === null || data === undefined) return { result: null, error: '' }
    try {
      return { result: JSONPath({ path: q, json: data }) as unknown[], error: '' }
    } catch (e) {
      return { result: null, error: (e as Error).message }
    }
  }, [query, data])

  if (data === null || data === undefined) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        Parse valid JSON to explore the tree
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* JSONPath filter bar */}
      <div className="flex flex-col gap-1 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-xs font-mono shrink-0">JSONPath</span>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="$.store.book[*].title"
            className="flex-1 bg-surface-900 border border-surface-700 rounded px-3 py-1 text-sm font-mono text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="btn text-xs px-2 py-1 bg-surface-700 text-text-secondary border border-surface-600 hover:bg-surface-600"
            >
              ✕
            </button>
          )}
        </div>
        {queryError && <p className="text-danger text-xs font-mono">{queryError}</p>}
        {filteredResult !== null && !queryError && (
          <p className="text-text-muted text-xs">
            {filteredResult.length} result{filteredResult.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Tree */}
      <div className="flex-1 min-h-0 overflow-auto rounded border border-surface-700/50 bg-surface-900/40 p-2 font-mono text-sm">
        {filteredResult !== null ? (
          filteredResult.length === 0
            ? <p className="text-text-muted italic px-2 py-1">No results</p>
            : filteredResult.map((item, i) => (
                <TreeNode key={i} nodeKey={i} value={item} depth={0} path={String(i)} highlightedPaths={highlightedPaths} />
              ))
        ) : (
          <TreeNode nodeKey={null} value={data} depth={0} path="" highlightedPaths={highlightedPaths} />
        )}
      </div>
    </div>
  )
}
