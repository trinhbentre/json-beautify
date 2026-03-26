import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  isTabularArray,
  extractColumns,
  compareValues,
  matchesFilter,
  exportToCsv,
  getNestedValue,
} from '../lib/tableUtils'

interface TableViewProps {
  data: unknown
}

type SortDir = 'asc' | 'desc' | null

const DEFAULT_COL_WIDTH = 150
const MIN_COL_WIDTH = 60

export function TableView({ data }: TableViewProps) {
  const [filterQuery, setFilterQuery] = useState('')
  const [debouncedFilter, setDebouncedFilter] = useState('')
  const [flatten, setFlatten] = useState(false)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const filterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleFilterChange = useCallback((value: string) => {
    setFilterQuery(value)
    if (filterTimerRef.current) clearTimeout(filterTimerRef.current)
    filterTimerRef.current = setTimeout(() => setDebouncedFilter(value), 200)
  }, [])

  const handleSortChange = useCallback((col: string) => {
    setSortColumn(prev => {
      if (prev !== col) { setSortDir('asc'); return col }
      return prev
    })
    setSortDir(prev => {
      if (sortColumn !== col) return 'asc'
      if (prev === 'asc') return 'desc'
      setSortColumn(null)
      return null
    })
  }, [sortColumn])

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        Parse valid JSON first
      </div>
    )
  }

  if (!isTabularArray(data)) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm text-center px-6">
        Table view requires an array of objects
      </div>
    )
  }

  return (
    <TableContent
      data={data}
      filterQuery={filterQuery}
      debouncedFilter={debouncedFilter}
      flatten={flatten}
      sortColumn={sortColumn}
      sortDir={sortDir}
      onFilterChange={handleFilterChange}
      onFlattenToggle={() => setFlatten(f => !f)}
      onSortChange={handleSortChange}
    />
  )
}

interface TableContentProps {
  data: object[]
  filterQuery: string
  debouncedFilter: string
  flatten: boolean
  sortColumn: string | null
  sortDir: SortDir
  onFilterChange: (v: string) => void
  onFlattenToggle: () => void
  onSortChange: (col: string) => void
}

function TableContent({
  data,
  filterQuery,
  debouncedFilter,
  flatten,
  sortColumn,
  sortDir,
  onFilterChange,
  onFlattenToggle,
  onSortChange,
}: TableContentProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const headerInnerRef = useRef<HTMLDivElement>(null)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})

  const columns = useMemo(() => extractColumns(data, flatten), [data, flatten])

  const processedRows = useMemo(() => {
    let rows = [...data]
    if (debouncedFilter) {
      rows = rows.filter(row => matchesFilter(row, columns, debouncedFilter))
    }
    if (sortColumn && sortDir) {
      const dir = sortDir === 'asc' ? 1 : -1
      rows = rows.sort((a, b) => {
        const av = getNestedValue(a, sortColumn)
        const bv = getNestedValue(b, sortColumn)
        return dir * compareValues(av, bv)
      })
    }
    return rows
  }, [data, columns, debouncedFilter, sortColumn, sortDir])

  const getColWidth = (key: string) => columnWidths[key] ?? DEFAULT_COL_WIDTH

  const totalWidth = useMemo(
    () => columns.reduce((sum, col) => sum + (columnWidths[col.key] ?? DEFAULT_COL_WIDTH), 0),
    [columns, columnWidths],
  )

  const virtualizer = useVirtualizer({
    count: processedRows.length,
    getScrollElement: () => bodyRef.current,
    estimateSize: () => 36,
    overscan: 15,
  })

  // Sync horizontal scroll from body → header via translateX (works with overflow:hidden)
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const onScroll = () => {
      if (headerInnerRef.current) {
        headerInnerRef.current.style.transform = `translateX(-${body.scrollLeft}px)`
      }
    }
    body.addEventListener('scroll', onScroll, { passive: true })
    return () => body.removeEventListener('scroll', onScroll)
  }, [])

  // Column resize — drag handle on right edge of each header cell
  const startResize = useCallback((e: React.MouseEvent, key: string, currentWidth: number) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const onMove = (ev: MouseEvent) => {
      setColumnWidths(prev => ({
        ...prev,
        [key]: Math.max(MIN_COL_WIDTH, currentWidth + ev.clientX - startX),
      }))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const handleExportCsv = useCallback(() => {
    const csv = exportToCsv(processedRows, columns)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `json-export-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [processedRows, columns])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-surface-700 bg-surface-800 flex-wrap">
        <input
          type="text"
          value={filterQuery}
          onChange={e => onFilterChange(e.target.value)}
          placeholder="Search rows…"
          className="bg-surface-700 border border-surface-600 rounded px-2 py-1 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent min-w-[140px] flex-1"
        />
        <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer select-none">
          <input type="checkbox" checked={flatten} onChange={onFlattenToggle} className="accent-accent" />
          Flatten nested
        </label>
        <button className="btn-primary text-xs" onClick={handleExportCsv} disabled={processedRows.length === 0}>
          Export CSV
        </button>
        <span className="text-xs text-text-muted whitespace-nowrap">
          {processedRows.length !== data.length
            ? `Showing ${processedRows.length.toLocaleString()} / ${data.length.toLocaleString()} rows`
            : `${data.length.toLocaleString()} rows`}
        </span>
      </div>

      {/* Header — overflow:hidden, horizontally shifted via transform to match body scroll */}
      <div className="shrink-0 overflow-hidden bg-surface-800 border-b border-surface-700">
        <div ref={headerInnerRef} className="flex" style={{ width: totalWidth }}>
          {columns.map(col => (
            <div
              key={col.key}
              className="relative flex items-center px-3 py-2 text-xs text-text-secondary font-semibold uppercase tracking-wide cursor-pointer hover:text-text-primary hover:bg-surface-700 border-r border-surface-700 last:border-r-0 select-none overflow-hidden"
              style={{ width: getColWidth(col.key), flexShrink: 0 }}
              onClick={() => onSortChange(col.key)}
            >
              <span className="flex items-center gap-1 truncate flex-1 min-w-0">
                <span className="truncate">{col.displayName}</span>
                {col.key === sortColumn && sortDir === 'asc' && <span className="shrink-0">▲</span>}
                {col.key === sortColumn && sortDir === 'desc' && <span className="shrink-0">▼</span>}
              </span>
              {/* Drag-to-resize handle */}
              <div
                className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-accent/60 z-10"
                onMouseDown={e => startResize(e, col.key, getColWidth(col.key))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Virtualized body — single scroll container (both axes) */}
      <div
        ref={bodyRef}
        className={`flex-1 overflow-auto ${processedRows.length === 0 ? 'flex items-center justify-center' : ''}`}
      >
        {processedRows.length === 0 ? (
          <span className="text-text-muted text-xs">No rows match the filter</span>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: totalWidth }}>
            {virtualizer.getVirtualItems().map(virtualRow => {
              const row = processedRows[virtualRow.index]
              const isEven = virtualRow.index % 2 === 0
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className={`flex absolute left-0 hover:bg-surface-700 ${isEven ? 'bg-surface-800' : 'bg-surface-900'}`}
                  style={{ top: 0, transform: `translateY(${virtualRow.start}px)`, width: totalWidth }}
                >
                  {columns.map(col => {
                    const value = getNestedValue(row, col.key)
                    const isNull = value === null || value === undefined
                    const displayValue = isNull
                      ? 'null'
                      : typeof value === 'object'
                        ? JSON.stringify(value)
                        : String(value)
                    return (
                      <div
                        key={col.key}
                        title={displayValue}
                        className={`px-3 py-2 text-xs border-r border-surface-700 last:border-r-0 overflow-hidden ${isNull ? 'text-text-muted' : 'text-text-primary'}`}
                        style={{ width: getColWidth(col.key), flexShrink: 0 }}
                      >
                        <div className="truncate">{displayValue}</div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
