/**
 * Text-preserving JSON formatter.
 *
 * Unlike JSON.parse → JSON.stringify, this parser treats number tokens as
 * opaque strings and re-emits them verbatim, so large integers such as
 * 249365294564827035 are never converted to a JavaScript float and never lose
 * precision.
 */

type Pos = { i: number }

type JNode =
  | { t: 'str'; raw: string }              // raw = original quoted token, e.g. "hello\nworld"
  | { t: 'num'; raw: string }              // raw = original number token, never coerced to float
  | { t: 'bool'; v: boolean }
  | { t: 'null' }
  | { t: 'arr'; items: JNode[] }
  | { t: 'obj'; entries: [string, string, JNode][] } // [parsedKey, rawKey, value]

function skipWs(s: string, p: Pos): void {
  while (p.i < s.length) {
    const c = s[p.i]
    if (c === ' ' || c === '\n' || c === '\r' || c === '\t') p.i++
    else break
  }
}

function parseStringToken(s: string, p: Pos): { v: string; raw: string } {
  const start = p.i
  p.i++ // skip opening "
  let v = ''
  while (p.i < s.length) {
    const c = s[p.i++]
    if (c === '"') break
    if (c === '\\') {
      const esc = s[p.i++]
      switch (esc) {
        case '"': v += '"'; break
        case '\\': v += '\\'; break
        case '/': v += '/'; break
        case 'b': v += '\b'; break
        case 'f': v += '\f'; break
        case 'n': v += '\n'; break
        case 'r': v += '\r'; break
        case 't': v += '\t'; break
        case 'u': {
          const hex = s.slice(p.i, p.i + 4)
          v += String.fromCharCode(parseInt(hex, 16))
          p.i += 4
          break
        }
        default: v += esc
      }
    } else {
      v += c
    }
  }
  return { v, raw: s.slice(start, p.i) }
}

function parseNode(s: string, p: Pos): JNode {
  skipWs(s, p)
  if (p.i >= s.length) throw new SyntaxError('Unexpected end of JSON input')
  const c = s[p.i]

  if (c === '"') {
    const { raw } = parseStringToken(s, p)
    return { t: 'str', raw }
  }

  if (c === '{') {
    p.i++
    skipWs(s, p)
    const entries: [string, string, JNode][] = []
    if (s[p.i] === '}') { p.i++; return { t: 'obj', entries } }
    while (true) {
      skipWs(s, p)
      if (s[p.i] !== '"') throw new SyntaxError(`Expected property name at position ${p.i}`)
      const { v: key, raw: rawKey } = parseStringToken(s, p)
      skipWs(s, p)
      if (s[p.i] !== ':') throw new SyntaxError(`Expected ':' at position ${p.i}`)
      p.i++ // skip :
      const value = parseNode(s, p)
      entries.push([key, rawKey, value])
      skipWs(s, p)
      if (s[p.i] === '}') { p.i++; break }
      if (s[p.i] !== ',') throw new SyntaxError(`Expected ',' or '}' at position ${p.i}`)
      p.i++ // skip ,
    }
    return { t: 'obj', entries }
  }

  if (c === '[') {
    p.i++
    skipWs(s, p)
    const items: JNode[] = []
    if (s[p.i] === ']') { p.i++; return { t: 'arr', items } }
    while (true) {
      items.push(parseNode(s, p))
      skipWs(s, p)
      if (s[p.i] === ']') { p.i++; break }
      if (s[p.i] !== ',') throw new SyntaxError(`Expected ',' or ']' at position ${p.i}`)
      p.i++ // skip ,
    }
    return { t: 'arr', items }
  }

  if (s.startsWith('true', p.i)) { p.i += 4; return { t: 'bool', v: true } }
  if (s.startsWith('false', p.i)) { p.i += 5; return { t: 'bool', v: false } }
  if (s.startsWith('null', p.i)) { p.i += 4; return { t: 'null' } }

  // number — scan without converting to float
  if (c === '-' || (c >= '0' && c <= '9')) {
    const start = p.i
    if (s[p.i] === '-') p.i++
    while (p.i < s.length && s[p.i] >= '0' && s[p.i] <= '9') p.i++
    if (p.i < s.length && s[p.i] === '.') {
      p.i++
      while (p.i < s.length && s[p.i] >= '0' && s[p.i] <= '9') p.i++
    }
    if (p.i < s.length && (s[p.i] === 'e' || s[p.i] === 'E')) {
      p.i++
      if (s[p.i] === '+' || s[p.i] === '-') p.i++
      while (p.i < s.length && s[p.i] >= '0' && s[p.i] <= '9') p.i++
    }
    return { t: 'num', raw: s.slice(start, p.i) }
  }

  throw new SyntaxError(`Unexpected token '${c}' at position ${p.i}`)
}

function sortNodeDeep(node: JNode): JNode {
  if (node.t === 'obj') {
    const sorted = [...node.entries]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, rk, v]) => [k, rk, sortNodeDeep(v)] as [string, string, JNode])
    return { t: 'obj', entries: sorted }
  }
  if (node.t === 'arr') {
    return { t: 'arr', items: node.items.map(sortNodeDeep) }
  }
  return node
}

function emitNode(
  node: JNode,
  indentStr: string,
  depth: number,
  minify: boolean,
): string {
  const nl = minify ? '' : '\n'
  const sp = minify ? '' : ' '
  const ind = minify ? '' : indentStr.repeat(depth)
  const ind1 = minify ? '' : indentStr.repeat(depth + 1)

  switch (node.t) {
    case 'str':
      return node.raw
    case 'num':
      return node.raw
    case 'bool':
      return node.v ? 'true' : 'false'
    case 'null':
      return 'null'
    case 'arr': {
      if (node.items.length === 0) return '[]'
      const items = node.items
        .map(item => ind1 + emitNode(item, indentStr, depth + 1, minify))
        .join(',' + nl)
      return '[' + nl + items + nl + ind + ']'
    }
    case 'obj': {
      if (node.entries.length === 0) return '{}'
      const pairs = node.entries
        .map(([, rawKey, v]) =>
          ind1 + rawKey + ':' + sp + emitNode(v, indentStr, depth + 1, minify),
        )
        .join(',' + nl)
      return '{' + nl + pairs + nl + ind + '}'
    }
  }
}

export interface ReformatOptions {
  indent: number | string
  sort: boolean
  minify?: boolean
}

/**
 * Reformat JSON text while preserving large-integer precision.
 * Throws a SyntaxError (same API as JSON.parse) if the input is invalid JSON.
 */
export function reformatJSON(input: string, opts: ReformatOptions): string {
  const p: Pos = { i: 0 }
  let node = parseNode(input, p)

  // Make sure there's no trailing non-whitespace content
  skipWs(input, p)
  if (p.i < input.length) {
    throw new SyntaxError(`Unexpected token '${input[p.i]}' at position ${p.i}`)
  }

  if (opts.sort) node = sortNodeDeep(node)

  const indentStr =
    typeof opts.indent === 'number' ? ' '.repeat(opts.indent) : opts.indent

  return emitNode(node, indentStr, 0, opts.minify ?? false)
}
