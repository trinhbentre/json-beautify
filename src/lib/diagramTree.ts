export interface DiagramNode {
  id: string
  label: string
  value?: string
  nodeType: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'
  children: DiagramNode[]
  childCount: number
  expanded: boolean
}

const MAX_ARRAY_INLINE = 10

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

let idCounter = 0

function nextId(): string {
  return String(++idCounter)
}

export function buildDiagramTree(data: unknown, key: string, maxDepth: number, depth = 0): DiagramNode {
  if (Array.isArray(data)) {
    const totalLen = data.length
    const items = totalLen > MAX_ARRAY_INLINE ? data.slice(0, MAX_ARRAY_INLINE) : data
    const children: DiagramNode[] = items.map((item, i) =>
      depth < maxDepth
        ? buildDiagramTree(item, String(i), maxDepth, depth + 1)
        : buildCollapsedNode(item, String(i))
    )
    if (totalLen > MAX_ARRAY_INLINE) {
      children.push({
        id: nextId(),
        label: `… and ${totalLen - MAX_ARRAY_INLINE} more`,
        nodeType: 'null',
        children: [],
        childCount: 0,
        expanded: false,
      })
    }
    return {
      id: nextId(),
      label: `${key}: [${totalLen}]`,
      nodeType: 'array',
      children,
      childCount: totalLen,
      expanded: depth < maxDepth,
    }
  }

  if (data !== null && typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>)
    const children: DiagramNode[] = entries.map(([k, v]) =>
      depth < maxDepth
        ? buildDiagramTree(v, k, maxDepth, depth + 1)
        : buildCollapsedNode(v, k)
    )
    return {
      id: nextId(),
      label: `${key}: {${entries.length}}`,
      nodeType: 'object',
      children,
      childCount: entries.length,
      expanded: depth < maxDepth,
    }
  }

  // Primitive
  const nodeType: DiagramNode['nodeType'] =
    data === null ? 'null'
    : typeof data === 'string' ? 'string'
    : typeof data === 'number' ? 'number'
    : 'boolean'

  const rawValue = JSON.stringify(data)
  return {
    id: nextId(),
    label: `${key}: ${truncate(rawValue, 50)}`,
    value: rawValue,
    nodeType,
    children: [],
    childCount: 0,
    expanded: false,
  }
}

function buildCollapsedNode(data: unknown, key: string): DiagramNode {
  if (Array.isArray(data)) {
    return {
      id: nextId(),
      label: `${key}: [${data.length}]`,
      nodeType: 'array',
      children: [],
      childCount: data.length,
      expanded: false,
    }
  }
  if (data !== null && typeof data === 'object') {
    const count = Object.keys(data as object).length
    return {
      id: nextId(),
      label: `${key}: {${count}}`,
      nodeType: 'object',
      children: [],
      childCount: count,
      expanded: false,
    }
  }
  const rawValue = JSON.stringify(data)
  const nodeType: DiagramNode['nodeType'] =
    data === null ? 'null'
    : typeof data === 'string' ? 'string'
    : typeof data === 'number' ? 'number'
    : 'boolean'
  return {
    id: nextId(),
    label: `${key}: ${truncate(rawValue, 50)}`,
    value: rawValue,
    nodeType,
    children: [],
    childCount: 0,
    expanded: false,
  }
}

export function toggleDiagramNode(root: DiagramNode, targetId: string): DiagramNode {
  if (root.id === targetId) {
    return { ...root, expanded: !root.expanded }
  }
  return {
    ...root,
    children: root.children.map(child => toggleDiagramNode(child, targetId)),
  }
}

export function expandToDepth(root: DiagramNode, depth: number, current = 0): DiagramNode {
  const shouldExpand = depth === -1 || current < depth
  return {
    ...root,
    expanded: shouldExpand && root.childCount > 0,
    children: root.children.map(child => expandToDepth(child, depth, current + 1)),
  }
}

export function countVisibleNodes(node: DiagramNode): number {
  let count = 1
  if (node.expanded) {
    for (const child of node.children) {
      count += countVisibleNodes(child)
    }
  }
  return count
}
