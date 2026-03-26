import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as d3 from 'd3'
import {
  buildDiagramTree,
  toggleDiagramNode,
  expandToDepth,
  countVisibleNodes,
  type DiagramNode,
} from '../lib/diagramTree'

interface DiagramViewProps {
  data: unknown
}

const NODE_FILL: Record<DiagramNode['nodeType'], string> = {
  object: '#58a6ff',   // accent
  array: '#3fb950',    // success
  string: '#d29922',   // warning
  number: '#79c0ff',   // accent-hover
  boolean: '#f85149',  // danger
  null: '#484f58',     // text-muted
}

const LARGE_NODE_THRESHOLD = 2000

interface HierarchyExtraNode extends d3.HierarchyNode<DiagramNode> {
  x: number
  y: number
}

function getVisibleTree(node: DiagramNode): DiagramNode {
  if (!node.expanded) return { ...node, children: [] }
  return { ...node, children: node.children.map(getVisibleTree) }
}

export function DiagramView({ data }: DiagramViewProps) {
  const isPrimitive = data !== null && typeof data !== 'object'

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        Parse valid JSON first
      </div>
    )
  }

  if (isPrimitive) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm text-center px-6">
        Diagram view requires an object or array
      </div>
    )
  }

  return <DiagramCanvas data={data} />
}

function DiagramCanvas({ data }: { data: unknown }) {
  const [tree, setTree] = useState<DiagramNode>(() => buildDiagramTree(data, 'root', 3))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [depth, setDepth] = useState(3)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  // true = next D3 render should do initial fit instead of preserving zoom
  const resetZoomRef = useRef(true)

  // Rebuild tree when data changes
  useEffect(() => {
    setTree(buildDiagramTree(data, 'root', 3))
    setSelectedId(null)
    setDepth(3)
    resetZoomRef.current = true
  }, [data])

  const visibleTree = useMemo(() => getVisibleTree(tree), [tree])
  const nodeCount = useMemo(() => countVisibleNodes(tree), [tree])

  const handleToggle = useCallback((id: string) => {
    setTree(prev => toggleDiagramNode(prev, id))
  }, [])

  const handleExpandToDepth = useCallback((d: number) => {
    setDepth(d)
    setTree(prev => expandToDepth(prev, d === -1 ? -1 : d, 0))
    resetZoomRef.current = true // re-fit after explicit depth/expand change
  }, [])

  const handleFitToScreen = useCallback(() => {
    const svg = svgRef.current
    const container = containerRef.current
    if (!svg || !container || !zoomRef.current) return
    const bounds = (svg.querySelector('g.tree-root') as SVGGElement)?.getBBox()
    if (!bounds) return
    const { width, height } = container.getBoundingClientRect()
    const padding = 40
    const scale = Math.min(
      (width - padding * 2) / bounds.width,
      (height - padding * 2) / bounds.height,
      2
    )
    const tx = (width - bounds.width * scale) / 2 - bounds.x * scale
    const ty = (height - bounds.height * scale) / 2 - bounds.y * scale
    d3.select(svg)
      .transition()
      .duration(400)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
  }, [])

  const handleExportSvg = useCallback(() => {
    const svg = svgRef.current
    if (!svg) return
    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(svg)
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `diagram-${Date.now()}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  // D3 rendering
  useEffect(() => {
    const svgEl = svgRef.current!
    const svg = d3.select(svgEl)
    const container = containerRef.current!
    const { width, height } = container.getBoundingClientRect()

    // Save current zoom transform and decide whether to fit or restore
    const savedTransform = d3.zoomTransform(svgEl)
    const shouldFit = resetZoomRef.current

    // Clear previous
    svg.selectAll('*').remove()

    const g = svg.append('g').attr('class', 'tree-root')

    // Build hierarchy
    const COL_WIDTH = 260  // horizontal distance between tree levels
    const ROW_HEIGHT = 22  // vertical distance between sibling nodes
    const LABEL_OFFSET = 14 // px from circle center to label start
    const LABEL_MAX_PX = COL_WIDTH - LABEL_OFFSET - 12 // max label width in px
    const APPROX_CHAR_PX = 7.2 // ~px per char at 12px monospace
    const MAX_LABEL_CHARS = Math.floor(LABEL_MAX_PX / APPROX_CHAR_PX)

    const root = d3.hierarchy<DiagramNode>(visibleTree, d => d.children)
    const treeLayout = d3.tree<DiagramNode>().nodeSize([ROW_HEIGHT, COL_WIDTH])
    treeLayout(root)

    const nodes = root.descendants() as HierarchyExtraNode[]
    const links = root.links()

    // Links
    g.selectAll<SVGPathElement, d3.HierarchyLink<DiagramNode>>('path.link')
      .data(links)
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', '#30363d')
      .attr('stroke-width', 1.5)
      .attr('d', d3.linkHorizontal<d3.HierarchyLink<DiagramNode>, d3.HierarchyPointNode<DiagramNode>>()
        .x(d => (d as unknown as HierarchyExtraNode).y)
        .y(d => (d as unknown as HierarchyExtraNode).x)
      )

    // Node groups
    const nodeGroups = g
      .selectAll<SVGGElement, HierarchyExtraNode>('g.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .style('cursor', d => d.data.childCount > 0 ? 'pointer' : 'default')
      .on('click', (_event, d) => {
        if (d.data.childCount > 0) {
          handleToggle(d.data.id)
        }
        setSelectedId(prev => prev === d.data.id ? null : d.data.id)
      })

    // Circle
    nodeGroups
      .append('circle')
      .attr('r', 6)
      .attr('fill', d => NODE_FILL[d.data.nodeType])
      .attr('stroke', d => d.data.id === selectedId ? '#58a6ff' : 'transparent')
      .attr('stroke-width', 2)

    // Expand/collapse badge
    nodeGroups
      .filter(d => d.data.childCount > 0)
      .append('text')
      .attr('x', 0)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('fill', '#8b949e')
      .text(d => d.data.expanded ? '−' : '+')

    // Label (truncated to fit column width, with <title> tooltip for full text)
    const labelGroups = nodeGroups
      .append('g')
      .attr('class', 'label-group')

    // Clipping rect per node so text never bleeds into sibling column
    labelGroups.each(function(_d, i) {
      const clipId = `lclip-${i}`
      d3.select(this)
        .append('clipPath')
        .attr('id', clipId)
        .append('rect')
        .attr('x', LABEL_OFFSET)
        .attr('y', -9)
        .attr('width', LABEL_MAX_PX)
        .attr('height', 18)
    })

    labelGroups.append('text')
      .attr('x', LABEL_OFFSET)
      .attr('y', 4)
      .attr('font-size', '12px')
      .attr('fill', '#e6edf3')
      .attr('font-family', 'ui-monospace, monospace')
      .attr('clip-path', (_d, i) => `url(#lclip-${i})`)
      .text(d => {
        const lbl = d.data.label
        return lbl.length > MAX_LABEL_CHARS ? lbl.slice(0, MAX_LABEL_CHARS - 1) + '…' : lbl
      })
      .append('title')
      .text(d => d.data.label)

    // Setup zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', event => {
        g.attr('transform', event.transform)
      })
    zoomRef.current = zoom
    svg.call(zoom)

    if (shouldFit) {
      // Initial fit — only on first render, data change, or explicit depth change
      resetZoomRef.current = false
      const bounds = (g.node() as SVGGElement)?.getBBox()
      if (bounds && bounds.width > 0) {
        const padding = 40
        const scale = Math.min(
          (width - padding * 2) / bounds.width,
          (height - padding * 2) / bounds.height,
          1.5
        )
        const tx = (width - bounds.width * scale) / 2 - bounds.x * scale
        const ty = (height - bounds.height * scale) / 2 - bounds.y * scale
        svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
      }
    } else {
      // Restore saved transform — preserves zoom/pan position on expand/collapse
      svg.call(zoom.transform, savedTransform)
    }
  }, [visibleTree, selectedId, handleToggle])

  // Find selected node for info panel
  const selectedNode = useMemo(() => {
    if (!selectedId) return null
    function find(node: DiagramNode): DiagramNode | null {
      if (node.id === selectedId) return node
      for (const child of node.children) {
        const found = find(child)
        if (found) return found
      }
      return null
    }
    return find(tree)
  }, [tree, selectedId])

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Large node warning */}
      {nodeCount > LARGE_NODE_THRESHOLD && (
        <div className="shrink-0 bg-warning/10 border-b border-warning/30 px-3 py-1.5 text-xs text-warning">
          Large tree ({nodeCount.toLocaleString()} nodes) — consider collapsing some branches
        </div>
      )}

      {/* Toolbar — top-left overlay */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 flex-wrap bg-surface-800/90 border border-surface-700 rounded px-2 py-1.5 backdrop-blur-sm">
        <button className="btn-secondary text-xs" onClick={() => handleExpandToDepth(-1)}>Expand All</button>
        <button className="btn-secondary text-xs" onClick={() => handleExpandToDepth(0)}>Collapse All</button>
        <select
          value={depth === -1 ? 'all' : String(depth)}
          onChange={e => handleExpandToDepth(e.target.value === 'all' ? -1 : Number(e.target.value))}
          className="bg-surface-700 border border-surface-600 rounded px-1.5 py-0.5 text-xs text-text-primary focus:outline-none focus:border-accent"
        >
          {[1, 2, 3, 4, 5].map(d => (
            <option key={d} value={d}>Depth {d}</option>
          ))}
          <option value="all">All</option>
        </select>
        <button className="btn-secondary text-xs" onClick={handleFitToScreen}>Fit</button>
        <button className="btn-secondary text-xs" onClick={handleExportSvg}>Export SVG</button>
      </div>

      {/* Zoom controls — top-right */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 bg-surface-800/90 border border-surface-700 rounded p-1 backdrop-blur-sm">
        <button
          className="btn-secondary text-xs w-6 h-6 flex items-center justify-center"
          onClick={() => {
            const svg = d3.select(svgRef.current!)
            if (zoomRef.current) svg.transition().duration(200).call(zoomRef.current.scaleBy, 1.4)
          }}
        >+</button>
        <button
          className="btn-secondary text-xs w-6 h-6 flex items-center justify-center"
          onClick={() => {
            const svg = d3.select(svgRef.current!)
            if (zoomRef.current) svg.transition().duration(200).call(zoomRef.current.scaleBy, 0.7)
          }}
        >−</button>
        <button
          className="btn-secondary text-xs px-1 py-0.5 text-[10px]"
          onClick={handleFitToScreen}
          title="Reset zoom"
        >⊡</button>
      </div>

      {/* SVG canvas */}
      <div ref={containerRef} className="flex-1 overflow-hidden">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="bg-surface-900"
        />
      </div>

      {/* Selected node info panel — bottom-left */}
      {selectedNode && (
        <div className="absolute bottom-2 left-2 z-10 bg-surface-800/95 border border-surface-700 rounded px-3 py-2 text-xs max-w-[300px] backdrop-blur-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: NODE_FILL[selectedNode.nodeType] }}
            />
            <span className="text-text-muted font-medium uppercase text-[10px] tracking-wide">{selectedNode.nodeType}</span>
          </div>
          <p className="text-text-secondary font-mono break-all leading-relaxed">
            {selectedNode.value
              ? selectedNode.value.length > 200
                ? selectedNode.value.slice(0, 200) + '…'
                : selectedNode.value
              : selectedNode.label}
          </p>
        </div>
      )}
    </div>
  )
}
