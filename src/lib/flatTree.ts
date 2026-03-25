export type NodeType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'

export interface FlatTreeNode {
  id: string
  depth: number
  key: string | number | null  // object key or array index; null for root
  value: unknown
  nodeType: NodeType
  childCount: number           // 0 for primitives
  expanded: boolean
  path: string                 // JSONPath-style, e.g. "$.users[0].name"
  parentId: string | null
}

function getNodeType(value: unknown): NodeType {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  switch (typeof value) {
    case 'object': return 'object'
    case 'string': return 'string'
    case 'number': return 'number'
    case 'boolean': return 'boolean'
    default: return 'null'
  }
}

function childCount(value: unknown): number {
  if (value === null || typeof value !== 'object') return 0
  return Array.isArray(value) ? value.length : Object.keys(value as object).length
}

/** Build the full flat tree with all nodes. Collapsed nodes hide their children. */
export function buildFlatTree(root: unknown, defaultExpandDepth = 2): FlatTreeNode[] {
  const nodes: FlatTreeNode[] = []
  let idCounter = 0

  function visit(
    value: unknown,
    key: string | number | null,
    depth: number,
    path: string,
    parentId: string | null,
  ) {
    const id = String(idCounter++)
    const nodeType = getNodeType(value)
    const count = childCount(value)
    const expanded = depth < defaultExpandDepth

    nodes.push({ id, depth, key, value, nodeType, childCount: count, expanded, path, parentId })

    if (expanded && count > 0) {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          visit(value[i], i, depth + 1, `${path}[${i}]`, id)
        }
      } else if (value !== null && typeof value === 'object') {
        for (const k of Object.keys(value as object)) {
          visit((value as Record<string, unknown>)[k], k, depth + 1, `${path}.${k}`, id)
        }
      }
    }
  }

  visit(root, null, 0, '$', null)
  return nodes
}

/** Toggle expanded/collapsed state of a node and rebuild the visible list. */
export function toggleNode(nodes: FlatTreeNode[], targetId: string): FlatTreeNode[] {
  // Flip expanded state on the target node
  const updated = nodes.map(n =>
    n.id === targetId ? { ...n, expanded: !n.expanded } : n,
  )

  // Rebuild visible list by re-inserting children when expanded or removing when collapsed
  const root = updated[0]
  if (!root) return updated

  // We need to reconstruct the tree from the original value
  // Since we store value on each node, we can expand the target node's value
  const target = updated.find(n => n.id === targetId)
  if (!target) return updated

  if (target.expanded) {
    // Insert children after target in the flat list
    return expandNode(updated, target)
  } else {
    // Remove all descendants of target
    return collapseNode(updated, targetId)
  }
}

function collapseNode(nodes: FlatTreeNode[], targetId: string): FlatTreeNode[] {
  const result: FlatTreeNode[] = []
  let skipping = false
  let skipDepth = -1

  for (const node of nodes) {
    if (node.id === targetId) {
      result.push(node)
      skipping = true
      skipDepth = node.depth
      continue
    }
    if (skipping) {
      if (node.depth > skipDepth) continue
      skipping = false
    }
    result.push(node)
  }
  return result
}

function expandNode(nodes: FlatTreeNode[], target: FlatTreeNode): FlatTreeNode[] {
  const result: FlatTreeNode[] = []
  let idCounter = nodes.length // continue numbering from where we left off

  // Build children nodes
  const children: FlatTreeNode[] = []
  function addChildren(value: unknown, depth: number, basePath: string, parentId: string) {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const id = String(idCounter++)
        const v = value[i]
        const nt = getNodeType(v)
        const cc = childCount(v)
        const path = `${basePath}[${i}]`
        children.push({ id, depth, key: i, value: v, nodeType: nt, childCount: cc, expanded: false, path, parentId })
      }
    } else if (value !== null && typeof value === 'object') {
      for (const k of Object.keys(value as object)) {
        const id = String(idCounter++)
        const v = (value as Record<string, unknown>)[k]
        const nt = getNodeType(v)
        const cc = childCount(v)
        const path = `${basePath}.${k}`
        children.push({ id, depth, key: k, value: v, nodeType: nt, childCount: cc, expanded: false, path, parentId })
      }
    }
  }

  addChildren(target.value, target.depth + 1, target.path, target.id)

  for (const node of nodes) {
    result.push(node)
    if (node.id === target.id) {
      result.push(...children)
    }
  }
  return result
}

export function expandAll(_nodes: FlatTreeNode[], root: unknown): FlatTreeNode[] {
  return buildFlatTree(root, Infinity)
}

export function collapseAll(_nodes: FlatTreeNode[], root: unknown): FlatTreeNode[] {
  return buildFlatTree(root, 0)
}
