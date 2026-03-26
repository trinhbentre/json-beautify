export interface PiiPattern {
  id: string
  label: string
  regex: RegExp
  enabled: boolean
}

export interface PiiMatch {
  patternId: string
  path: string
  originalValue: string
  startIndex: number
  endIndex: number
}

export const DEFAULT_PATTERNS: PiiPattern[] = [
  {
    id: 'email',
    label: 'Email',
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    enabled: true,
  },
  {
    id: 'phone',
    label: 'Phone',
    regex: /(\+?\d{1,4}[\s.-]?)?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,9}/g,
    enabled: true,
  },
  {
    id: 'ipv4',
    label: 'IPv4',
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    enabled: true,
  },
  {
    id: 'ipv6',
    label: 'IPv6',
    regex: /\b([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
    enabled: true,
  },
  {
    id: 'jwt',
    label: 'JWT Token',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    enabled: true,
  },
  {
    id: 'credit_card',
    label: 'Credit Card',
    regex: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
    enabled: true,
  },
  {
    id: 'ssn',
    label: 'SSN',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    enabled: true,
  },
]

function traverseForPii(
  value: unknown,
  path: string,
  patterns: PiiPattern[],
  matches: PiiMatch[],
): void {
  if (typeof value === 'string') {
    for (const pattern of patterns) {
      if (!pattern.enabled) continue
      // Create fresh RegExp each time to avoid lastIndex carry-over
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags)
      let match: RegExpExecArray | null
      while ((match = regex.exec(value)) !== null) {
        matches.push({
          patternId: pattern.id,
          path,
          originalValue: value,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        })
      }
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => {
      traverseForPii(item, `${path}[${i}]`, patterns, matches)
    })
  } else if (value !== null && typeof value === 'object') {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key
      traverseForPii(val, childPath, patterns, matches)
    }
  }
}

export function detectPii(json: unknown, patterns: PiiPattern[]): PiiMatch[] {
  const matches: PiiMatch[] = []
  traverseForPii(json, '', patterns, matches)
  return matches
}

// --- Masking ---

function maskValueAsterisk(value: string, valueMatches: PiiMatch[]): string {
  // Process end-to-start so earlier indices remain valid
  const sorted = [...valueMatches].sort((a, b) => b.startIndex - a.startIndex)
  let result = value
  for (const m of sorted) {
    result = result.slice(0, m.startIndex) + '****' + result.slice(m.endIndex)
  }
  return result
}

async function hashSubstring(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 8)
}

async function maskValueHash(value: string, valueMatches: PiiMatch[]): Promise<string> {
  const sorted = [...valueMatches].sort((a, b) => b.startIndex - a.startIndex)
  let result = value
  for (const m of sorted) {
    const hash = await hashSubstring(value.slice(m.startIndex, m.endIndex))
    result = result.slice(0, m.startIndex) + `[SHA256:${hash}]` + result.slice(m.endIndex)
  }
  return result
}

async function traverseAndMask(
  value: unknown,
  path: string,
  matchesByPath: Map<string, PiiMatch[]>,
  mode: 'asterisk' | 'hash',
): Promise<unknown> {
  if (typeof value === 'string') {
    const valueMatches = matchesByPath.get(path)
    if (!valueMatches?.length) return value
    return mode === 'asterisk'
      ? maskValueAsterisk(value, valueMatches)
      : maskValueHash(value, valueMatches)
  }
  if (Array.isArray(value)) {
    return Promise.all(
      value.map((item, i) => traverseAndMask(item, `${path}[${i}]`, matchesByPath, mode))
    )
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key
      result[key] = await traverseAndMask(val, childPath, matchesByPath, mode)
    }
    return result
  }
  return value
}

export async function maskJson(
  json: unknown,
  matches: PiiMatch[],
  mode: 'asterisk' | 'hash',
): Promise<unknown> {
  const matchesByPath = new Map<string, PiiMatch[]>()
  for (const m of matches) {
    const arr = matchesByPath.get(m.path) ?? []
    arr.push(m)
    matchesByPath.set(m.path, arr)
  }
  return traverseAndMask(json, '', matchesByPath, mode)
}

export function unmaskJson(_maskedJson: unknown, originalJson: unknown): unknown {
  return JSON.parse(JSON.stringify(originalJson))
}
