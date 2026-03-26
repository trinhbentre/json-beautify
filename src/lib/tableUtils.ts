import Papa from 'papaparse'

export interface Column {
  key: string
  displayName: string
  type: 'string' | 'number' | 'boolean' | 'null' | 'mixed'
}

export function isTabularArray(data: unknown): data is object[] {
  if (!Array.isArray(data) || data.length === 0) return false
  const objectCount = data.filter(
    item => item !== null && typeof item === 'object' && !Array.isArray(item),
  ).length
  return objectCount / data.length >= 0.8
}

function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey))
    } else {
      result[fullKey] = value
    }
  }
  return result
}

export function extractColumns(data: object[], flatten: boolean): Column[] {
  const keyOrder: string[] = []
  const keySet = new Set<string>()
  const keyTypes: Record<string, Set<string>> = {}

  for (const item of data) {
    const obj = flatten
      ? flattenObject(item as Record<string, unknown>)
      : (item as Record<string, unknown>)
    for (const [key, value] of Object.entries(obj)) {
      if (!keySet.has(key)) {
        keySet.add(key)
        keyOrder.push(key)
      }
      if (!keyTypes[key]) keyTypes[key] = new Set()
      if (value === null) keyTypes[key].add('null')
      else keyTypes[key].add(typeof value)
    }
  }

  return keyOrder.map(key => {
    const types = keyTypes[key]
    let type: Column['type'] = 'mixed'
    if (types.size === 1) {
      const t = Array.from(types)[0]
      if (t === 'string') type = 'string'
      else if (t === 'number') type = 'number'
      else if (t === 'boolean') type = 'boolean'
      else if (t === 'null') type = 'null'
    }
    return { key, displayName: key, type }
  })
}

export function getNestedValue(obj: object, path: string): unknown {
  return path.split('.').reduce<unknown>((current, part) => {
    if (current === null || current === undefined) return undefined
    return (current as Record<string, unknown>)[part]
  }, obj)
}

export function compareValues(a: unknown, b: unknown): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

export function matchesFilter(row: object, columns: Column[], query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  for (const col of columns) {
    const value = getNestedValue(row, col.key)
    if (value !== null && value !== undefined && String(value).toLowerCase().includes(q)) return true
  }
  return false
}

export function exportToCsv(data: object[], columns: Column[]): string {
  const rows = data.map(row => {
    const entry: Record<string, unknown> = {}
    for (const col of columns) {
      entry[col.displayName] = getNestedValue(row, col.key)
    }
    return entry
  })
  return Papa.unparse(rows, { columns: columns.map(c => c.displayName) })
}
