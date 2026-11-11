import { forceCollide } from 'd3-force-3d'
import { useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from 'react-force-graph-2d'
import { readableOn, withAlpha } from '@/domain/color'
import { formatBRL } from '@/domain/money'
import { titleKey, type Graph, type GraphNode } from '@/domain/wikilinks'
import { useThemeColors } from '@/store/selectors'
import { useData } from '@/store/useAppStore'
import { KIND } from './kinds'
import { drawIcon, subscriptionLook, type SubscriptionLook } from './subscriptionIcon'

type GNode = NodeObject<GraphNode>
type GLink = LinkObject<GraphNode, { source: string | GNode; target: string | GNode }>

const DIM = 0.16

function radius(n: GraphNode): number {
  // assinaturas levam o ícone dentro do círculo, então partem de um tamanho que o deixe legível
  if (n.kind === 'subscription') return n.inactive ? 11 : 12 + Math.sqrt(Math.max(0, n.monthly) / 100) * 0.55
  if (n.kind === 'note' || n.kind === 'ghost') return 4
  return 6.5 + Math.min(4, n.degree * 0.3)
}

const endId = (end: string | GNode | undefined): string => (typeof end === 'object' && end ? String(end.id) : String(end))

/**
 * Grafo de força, como a "graph view" do Obsidian: arrastar, zoom, destaque de
 * vizinhos ao passar o ponteiro e clique (ou toque) para abrir a nota.
 */
export function GraphView({
  graph,
  centerId,
  height,
  onOpen,
  showAllLabels = false,
}: {
  graph: Graph
  centerId?: string
  height: number | string
  onOpen: (node: GraphNode) => void
  showAllLabels?: boolean
}) {
  const reduced = useReducedMotion()
  const theme = useThemeColors()
  const { notes, members } = useData()
  const wrapRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<ForceGraphMethods<GNode, GLink> | undefined>(undefined)
  const positions = useRef(new Map<string, { x?: number; y?: number }>())
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [hover, setHover] = useState<string | null>(null)
  const fitted = useRef(false)
  const [, setTick] = useState(0)
  const redraw = () => setTick((t) => t + 1)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height: h } = entry.contentRect
      setSize({ w: Math.floor(width), h: Math.floor(h) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // aparência de cada nó: ícone e cor da assinatura, cor do morador
  const looks = useMemo(() => {
    const subs = new Map<string, SubscriptionLook>()
    for (const n of notes) if (n.kind === 'subscription' && n.subscription) subs.set(n.id, subscriptionLook(n))
    const memberColor = new Map(members.map((m) => [titleKey(m.name), m.color]))
    return { subs, memberColor }
  }, [notes, members])

  // só reconstrói quando a estrutura muda; digitar texto numa nota não reinicia a simulação
  const signature = useMemo(
    () =>
      graph.nodes.map((n) => `${n.id}|${n.kind}|${n.monthly}|${n.inactive ? 1 : 0}|${n.title}`).join(';') +
      '#' +
      graph.links.map((l) => `${l.source}>${l.target}`).join(';'),
    [graph],
  )
  const data = useMemo(() => {
    const nodes: GNode[] = graph.nodes.map((n) => ({ ...n, ...positions.current.get(n.id) }))
    const links: GLink[] = graph.links.map((l) => ({ source: l.source, target: l.target }))
    fitted.current = false
    return { nodes, links }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const neighbors = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const l of graph.links) {
      if (!map.has(l.source)) map.set(l.source, new Set())
      if (!map.has(l.target)) map.set(l.target, new Set())
      map.get(l.source)!.add(l.target)
      map.get(l.target)!.add(l.source)
    }
    return map
  }, [graph])

  // o grafo só existe depois de medir o contêiner, então as forças dependem de `ready`
  const ready = size.w > 0
  const narrow = size.w < 520
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    fg.d3Force('charge')?.strength(centerId ? -240 : narrow ? -200 : -300)
    fg.d3Force('link')?.distance(centerId ? 60 : narrow ? 50 : 62)
    // colisão: nenhum nó encosta no outro, e sobra espaço para o rótulo embaixo
    fg.d3Force('collide', forceCollide<GNode>((n) => radius(n as GraphNode) + (centerId ? 12 : narrow ? 9 : 15)) as never)
    fg.d3ReheatSimulation()
  }, [data, centerId, ready, narrow])

  /** Enquadra o grafo sem exagerar no zoom quando há poucos nós. */
  const fit = (ms: number) => {
    const fg = fgRef.current
    if (!fg) return
    fg.zoomToFit(ms, centerId ? 40 : narrow ? 22 : 40)
    const cap = centerId ? 1.7 : 2.2
    window.setTimeout(() => {
      if (fg.zoom() > cap) fg.zoom(cap, ms ? 200 : 0)
    }, ms + 30)
  }

  // primeiro enquadramento cedo, para o grafo não nascer pequeno no canto; o definitivo vem ao estabilizar
  useEffect(() => {
    if (size.w === 0) return
    const id = window.setTimeout(() => fit(reduced ? 0 : 400), reduced ? 0 : 700)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, ready])

  const ink = theme.foreground
  const surface = theme.card
  const kindColor = (n: GraphNode): string => {
    if (n.kind === 'subscription') return (n.note_id && looks.subs.get(n.note_id)?.color) || KIND.subscription.color
    if (n.kind === 'member') return looks.memberColor.get(n.id) ?? KIND.member.color
    if (n.kind === 'payment') return theme.mutedForeground
    if (n.kind === 'note' || n.kind === 'ghost') return theme.faint
    return KIND[n.kind].color
  }

  const focus = hover ?? null
  const isLit = (id: string) => !focus || id === focus || neighbors.get(focus)?.has(id)
  const hovered = focus ? graph.nodes.find((n) => n.id === focus) : null

  return (
    <div ref={wrapRef} className="relative w-full touch-none overflow-hidden rounded-xl" style={{ height }}>
      {size.w > 0 && (
        <ForceGraph2D<GNode, GLink>
          ref={fgRef}
          graphData={data}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          warmupTicks={reduced ? 160 : 30}
          cooldownTicks={reduced ? 0 : 160}
          d3VelocityDecay={0.34}
          minZoom={0.35}
          maxZoom={6}
          nodeRelSize={1}
          nodeVal={(n) => radius(n) ** 2}
          linkColor={(l) => {
            const lit = !focus || endId(l.source) === focus || endId(l.target) === focus
            return withAlpha(ink, lit ? (focus ? 0.6 : 0.2) : 0.06)
          }}
          linkWidth={(l) => (focus && (endId(l.source) === focus || endId(l.target) === focus) ? 1.5 : 1)}
          onNodeHover={(n) => {
            setHover(n ? String(n.id) : null)
            if (wrapRef.current) wrapRef.current.style.cursor = n ? 'pointer' : 'grab'
          }}
          onNodeClick={(n) => onOpen(n)}
          onNodeDragEnd={(n) => {
            positions.current.set(String(n.id), { x: n.x, y: n.y })
          }}
          onEngineStop={() => {
            for (const n of data.nodes) positions.current.set(String(n.id), { x: n.x, y: n.y })
            if (!fitted.current) {
              fitted.current = true
              fit(reduced ? 0 : 500)
            }
          }}
          nodePointerAreaPaint={(n, color, ctx) => {
            // área de toque maior que a marca
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(n.x ?? 0, n.y ?? 0, Math.max(12, radius(n) + 5), 0, Math.PI * 2)
            ctx.fill()
          }}
          nodeCanvasObject={(n, ctx, scale) => {
            const x = n.x ?? 0
            const y = n.y ?? 0
            const r = radius(n)
            const id = String(n.id)
            const lit = isLit(id)
            const shape = KIND[n.kind].shape
            const color = kindColor(n)
            ctx.globalAlpha = (lit ? 1 : DIM) * (n.inactive ? 0.55 : 1)

            // anel na cor da superfície: separa marcas que se sobrepõem
            ctx.lineWidth = 2 / scale
            ctx.strokeStyle = surface
            ctx.fillStyle = color
            ctx.beginPath()
            if (shape === 'square') {
              const s = r * 0.9
              ctx.roundRect(x - s, y - s, s * 2, s * 2, s * 0.28)
            } else if (shape === 'diamond') {
              const s = r * 1.15
              ctx.moveTo(x, y - s)
              ctx.lineTo(x + s, y)
              ctx.lineTo(x, y + s)
              ctx.lineTo(x - s, y)
              ctx.closePath()
            } else if (shape === 'triangle') {
              const s = r * 1.15
              ctx.moveTo(x, y - s)
              ctx.lineTo(x + s, y + s * 0.85)
              ctx.lineTo(x - s, y + s * 0.85)
              ctx.closePath()
            } else {
              ctx.arc(x, y, r, 0, Math.PI * 2)
            }
            if (shape === 'ring') {
              ctx.setLineDash([2.2 / scale, 2 / scale])
              ctx.lineWidth = 1.3 / scale
              ctx.strokeStyle = color
              ctx.stroke()
              ctx.setLineDash([])
            } else {
              ctx.stroke()
              ctx.fill()
            }

            // logotipo ou ícone da assinatura dentro do círculo
            const look = n.kind === 'subscription' && n.note_id ? looks.subs.get(n.note_id) : undefined
            if (look) drawIcon(ctx, look.icon, x, y, r * 2, readableOn(color), redraw)

            if (id === centerId || id === focus) {
              ctx.beginPath()
              ctx.arc(x, y, r + 3.5 / scale + 1.5, 0, Math.PI * 2)
              ctx.lineWidth = 1.5 / scale
              ctx.strokeStyle = ink
              ctx.stroke()
            }

            // rótulos seletivos: foco e vizinhos, nós centrais, ou tudo com zoom suficiente
            const always = showAllLabels || id === centerId || (focus !== null && lit)
            const hub = (n.kind === 'member' || n.kind === 'group' || n.kind === 'payment') && n.degree >= 3
            if (always || (hub && scale > 0.6) || scale > 1.15) {
              const fontSize = Math.max(11 / scale, 2.6)
              ctx.font = `${id === centerId || id === focus ? 600 : 500} ${fontSize}px "Geist Variable", system-ui, sans-serif`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'top'
              const ty = y + r * (shape === 'circle' ? 1 : 1.2) + 4 / scale
              ctx.lineWidth = 3.5 / scale
              ctx.strokeStyle = surface
              ctx.lineJoin = 'round'
              ctx.strokeText(n.title, x, ty)
              ctx.fillStyle = ink
              ctx.fillText(n.title, x, ty)
            }
            ctx.globalAlpha = 1
          }}
        />
      )}

      {/* leitura do nó em foco: o valor também existe na lista e na nota, o hover só adianta */}
      <div
        aria-live="polite"
        className="pointer-events-none absolute bottom-2 left-2 max-w-[calc(100%-1rem)] rounded-lg border border-foreground/12 bg-popover px-2.5 py-1.5 text-xs text-popover-foreground transition-opacity duration-150"
        style={{ opacity: hovered ? 1 : 0 }}
      >
        {hovered && (
          <>
            <span className="font-medium">{hovered.title}</span>
            <span className="text-muted-foreground">
              {' · '}
              {KIND[hovered.kind].label}
              {hovered.kind === 'subscription' && (hovered.inactive ? ' inativa' : ` · ${formatBRL(hovered.monthly)}/mês`)}
              {` · ${hovered.degree} ${hovered.degree === 1 ? 'ligação' : 'ligações'}`}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
