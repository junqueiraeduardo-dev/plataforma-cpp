import { useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from 'react-force-graph-2d'
import { MemberAvatar } from '@/components/common/MemberAvatar'
import { readableOn, withAlpha } from '@/domain/color'
import { relativeDay } from '@/domain/dates'
import { formatBRL, formatBRLRound } from '@/domain/money'
import { CENTER_R, layoutClusters, SPACING } from '@/domain/payerLayout'
import type { Member } from '@/domain/types'
import { cn } from '@/lib/utils'
import { useThemeColors, useToday, type SubscriptionRow } from '@/store/selectors'
import { drawIcon, subscriptionLook, type SubscriptionLook } from './subscriptionIcon'

interface PNode {
  id: string
  kind: 'payer' | 'sub'
  cluster: string
  title: string
  r: number
  color: string
  inactive?: boolean
  look?: SubscriptionLook
  photo?: string | null
  row?: SubscriptionRow
  monthly: number
  count?: number
  /** Largura máxima do rótulo, em unidades do grafo. */
  label?: number
}
type GNode = NodeObject<PNode>
type GLink = LinkObject<PNode, { source: string | GNode; target: string | GNode; inactive?: boolean }>

const NOBODY = 'sem-pagador'

function subRadius(row: SubscriptionRow): number {
  if (row.sub.status !== 'active') return 14
  return Math.min(24, 15 + Math.sqrt(Math.max(0, row.monthly) / 100) * 0.55)
}

const fitCache = new Map<string, string>()
/** Corta o texto com reticências para caber em `max` (na fonte já configurada no contexto). */
function fitText(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  const key = `${ctx.font}|${max}|${text}`
  const hit = fitCache.get(key)
  if (hit) return hit
  let out = text
  if (ctx.measureText(text).width > max) {
    let cut = text.length
    while (cut > 1 && ctx.measureText(`${text.slice(0, cut).trimEnd()}…`).width > max) cut--
    out = `${text.slice(0, cut).trimEnd()}…`
  }
  fitCache.set(key, out)
  return out
}

/**
 * Grafo "quem paga": cada pagador no centro do seu grupo, as assinaturas dele
 * em anel ao redor. A disposição é calculada (não é simulação), então os grupos
 * nunca se sobrepõem e a distância entre eles é sempre a mesma.
 */
export function PayerGraph({
  rows,
  members,
  height,
  onOpenNote,
}: {
  rows: SubscriptionRow[]
  members: Member[]
  height: number | string
  onOpenNote: (noteId: string) => void
}) {
  const reduced = useReducedMotion()
  const theme = useThemeColors()
  const todayISO = useToday()
  const wrapRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<ForceGraphMethods<GNode, GLink> | undefined>(undefined)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [hover, setHover] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
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

  // grupos: um por pagador que tem assinatura, o que mais gasta primeiro
  const groups = useMemo(() => {
    const byPayer = new Map<string, SubscriptionRow[]>()
    for (const row of rows) {
      const id = members.some((m) => m.id === row.sub.payer_id) ? row.sub.payer_id : NOBODY
      byPayer.set(id, [...(byPayer.get(id) ?? []), row])
    }
    return [...byPayer.entries()]
      .map(([id, list]) => ({
        id,
        member: members.find((m) => m.id === id),
        // ativas primeiro, da mais cara para a mais barata, a partir do topo do anel
        rows: [...list].sort(
          (a, b) => Number(b.sub.status === 'active') - Number(a.sub.status === 'active') || b.monthly - a.monthly || a.note.title.localeCompare(b.note.title, 'pt-BR'),
        ),
        monthly: list.reduce((s, r) => s + (r.sub.status === 'active' ? r.monthly : 0), 0),
      }))
      .sort((a, b) => b.monthly - a.monthly || (a.member?.name ?? 'zz').localeCompare(b.member?.name ?? 'zz', 'pt-BR'))
  }, [rows, members])

  // o número de colunas depende do formato da área; arredondado para não refazer a cada pixel
  const aspect = size.h > 0 ? Math.round((size.w / size.h) * 4) / 4 : 1
  const data = useMemo(() => {
    const layout = layoutClusters(
      groups.map((g) => ({ id: g.id, items: g.rows.map((r) => ({ id: r.note.id, r: subRadius(r) })) })),
      aspect,
    )
    const nodes: GNode[] = []
    const links: GLink[] = []
    for (const cluster of layout.clusters) {
      const group = groups.find((g) => g.id === cluster.id)
      if (!group) continue
      const payerId = `payer:${cluster.id}`
      nodes.push({
        id: payerId,
        kind: 'payer',
        cluster: cluster.id,
        title: group.member?.name ?? 'Sem pagador',
        r: CENTER_R,
        color: group.member?.color ?? theme.faint,
        photo: group.member?.photo,
        monthly: group.monthly,
        count: group.rows.filter((r) => r.sub.status === 'active').length,
        x: cluster.x,
        y: cluster.y,
        fx: cluster.x,
        fy: cluster.y,
      })
      for (const item of cluster.items) {
        const row = group.rows.find((r) => r.note.id === item.id)
        if (!row) continue
        const look = subscriptionLook(row.note)
        const inactive = row.sub.status !== 'active'
        nodes.push({
          id: item.id,
          kind: 'sub',
          cluster: cluster.id,
          title: row.note.title,
          r: item.r,
          color: look.color,
          look,
          inactive,
          row,
          monthly: row.monthly,
          label: item.label,
          x: item.x,
          y: item.y,
          fx: item.x,
          fy: item.y,
        })
        links.push({ source: payerId, target: item.id, inactive })
      }
    }
    return { nodes, links, layout }
  }, [groups, aspect, theme.faint])

  /** Enquadra tudo ou um grupo, contando os rótulos (o enquadramento da biblioteca só vê os centros). */
  const fit = (ms: number, cluster: string | null) => {
    const fg = fgRef.current
    if (!fg || size.w === 0) return
    const pad = size.w < 520 ? 10 : 28
    const target = cluster ? data.layout.clusters.find((c) => c.id === cluster) : null
    const width = target ? target.extent * 2 : data.layout.width
    const height = target ? target.extent * 2 : data.layout.height
    if (width <= 0 || height <= 0) return
    // um grupo pequeno sozinho não precisa ocupar a tela inteira
    const zoom = Math.min(2.3, (size.w - pad * 2) / width, (size.h - pad * 2) / height)
    fg.centerAt(target?.x ?? 0, target?.y ?? 0, ms)
    fg.zoom(zoom, ms)
  }

  const focusValid = focus && groups.some((g) => g.id === focus) ? focus : null
  useEffect(() => {
    if (size.w === 0) return
    const id = window.setTimeout(() => fit(reduced ? 0 : 520, focusValid), 60)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, focusValid, size.w, size.h])

  const ink = theme.foreground
  const surface = theme.card
  const graphData = useMemo(() => ({ nodes: data.nodes, links: data.links }), [data])
  const hovered = hover ? data.nodes.find((n) => n.id === hover) : null
  const sharedNames = (row: SubscriptionRow) =>
    row.sub.shared_with
      .filter((id) => id !== row.sub.payer_id)
      .map((id) => members.find((m) => m.id === id)?.name)
      .filter((n): n is string => !!n)

  const chip = (on: boolean) =>
    cn(
      'press inline-flex ctl-sm shrink-0 items-center gap-2 rounded-full border pr-3.5 pl-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
      on ? 'border-primary bg-accent font-medium text-foreground' : 'border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground',
    )

  return (
    <div>
      {/* um botão por pagador: aproxima o grupo dele; também serve de legenda */}
      <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-2 pb-3 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-1" role="group" aria-label="Aproximar o grupo de um pagador">
        <button type="button" aria-pressed={!focusValid} onClick={() => setFocus(null)} className={cn(chip(!focusValid), 'pl-3.5')}>
          Todos
        </button>
        {groups.map((g) => (
          <button key={g.id} type="button" aria-pressed={focusValid === g.id} onClick={() => setFocus(focusValid === g.id ? null : g.id)} className={chip(focusValid === g.id)}>
            <MemberAvatar member={g.member} size="sm" />
            <span className="max-w-28 truncate">{g.member?.name ?? 'Sem pagador'}</span>
            <span className="num text-xs font-normal text-muted-foreground">{formatBRLRound(g.monthly)}/mês</span>
          </button>
        ))}
      </div>

      <div
        ref={wrapRef}
        role="img"
        aria-label={`Grafo de quem paga cada assinatura: ${groups.map((g) => `${g.member?.name ?? 'Sem pagador'}, ${g.rows.length} ${g.rows.length === 1 ? 'assinatura' : 'assinaturas'}`).join('; ')}.`}
        className="relative w-full touch-none overflow-hidden rounded-xl"
        style={{ height }}
      >
        {size.w > 0 && (
          <ForceGraph2D<GNode, GLink>
            ref={fgRef}
            graphData={graphData}
            width={size.w}
            height={size.h}
            backgroundColor="rgba(0,0,0,0)"
            warmupTicks={0}
            cooldownTicks={0}
            enableNodeDrag={false}
            minZoom={0.3}
            maxZoom={5}
            nodeRelSize={1}
            nodeVal={(n) => n.r ** 2}
            linkColor={(l) => withAlpha(ink, l.inactive ? 0.08 : 0.2)}
            linkWidth={1}
            onNodeHover={(n) => {
              setHover(n ? String(n.id) : null)
              if (wrapRef.current) wrapRef.current.style.cursor = n ? 'pointer' : 'grab'
            }}
            onNodeClick={(n) => {
              if (n.kind === 'payer') setFocus((current) => (current === n.cluster ? null : n.cluster))
              else onOpenNote(String(n.id))
            }}
            onBackgroundClick={() => setFocus(null)}
            nodePointerAreaPaint={(n, color, ctx) => {
              ctx.fillStyle = color
              ctx.beginPath()
              ctx.arc(n.x ?? 0, n.y ?? 0, n.r + 6, 0, Math.PI * 2)
              ctx.fill()
            }}
            nodeCanvasObject={(n, ctx, scale) => {
              const x = n.x ?? 0
              const y = n.y ?? 0
              const id = String(n.id)
              const isHover = id === hover
              ctx.globalAlpha = n.inactive ? 0.45 : 1

              if (n.kind === 'payer') {
                // anel na cor do morador: identifica o grupo mesmo com foto
                ctx.beginPath()
                ctx.arc(x, y, n.r + 3.5, 0, Math.PI * 2)
                ctx.fillStyle = n.color
                ctx.fill()
                ctx.beginPath()
                ctx.arc(x, y, n.r + 1.5, 0, Math.PI * 2)
                ctx.fillStyle = surface
                ctx.fill()
                ctx.beginPath()
                ctx.arc(x, y, n.r, 0, Math.PI * 2)
                ctx.fillStyle = n.color
                ctx.fill()
                if (n.photo) drawIcon(ctx, { kind: 'image', src: n.photo, label: n.title }, x, y, n.r * 2, ink, redraw)
                else {
                  ctx.fillStyle = readableOn(n.color)
                  ctx.font = `700 ${n.r * 0.95}px "Geist Variable", system-ui, sans-serif`
                  ctx.textAlign = 'center'
                  ctx.textBaseline = 'middle'
                  ctx.fillText(n.title.slice(0, 1).toUpperCase(), x, y + n.r * 0.04)
                }
                // nome sempre legível: cresce quando o grafo está afastado
                const nameSize = Math.min(24, Math.max(13, 11.5 / scale))
                ctx.font = `600 ${nameSize}px "Geist Variable", system-ui, sans-serif`
                ctx.textAlign = 'center'
                ctx.textBaseline = 'top'
                const ty = y + n.r + 7
                ctx.lineJoin = 'round'
                ctx.lineWidth = nameSize * 0.32
                ctx.strokeStyle = surface
                const name = fitText(ctx, n.title, 130)
                ctx.strokeText(name, x, ty)
                ctx.fillStyle = ink
                ctx.fillText(name, x, ty)
                if (scale >= 0.85) {
                  ctx.font = `500 10px "Geist Variable", system-ui, sans-serif`
                  const total = `${formatBRLRound(n.monthly)}/mês`
                  ctx.lineWidth = 3
                  ctx.strokeText(total, x, ty + nameSize + 2)
                  ctx.fillStyle = theme.mutedForeground
                  ctx.fillText(total, x, ty + nameSize + 2)
                }
              } else {
                ctx.lineWidth = 2
                ctx.strokeStyle = surface
                ctx.fillStyle = n.color
                ctx.beginPath()
                ctx.arc(x, y, n.r, 0, Math.PI * 2)
                ctx.stroke()
                ctx.fill()
                if (n.look) drawIcon(ctx, n.look.icon, x, y, n.r * 2, readableOn(n.color), redraw)
                if (isHover) {
                  ctx.beginPath()
                  ctx.arc(x, y, n.r + 3.5, 0, Math.PI * 2)
                  ctx.lineWidth = 1.5
                  ctx.strokeStyle = ink
                  ctx.stroke()
                }
                // o nome acompanha o zoom; afastado demais, fica só o logotipo
                if (scale >= 0.78 || isHover) {
                  const fontSize = isHover ? Math.max(10.5, 11.5 / scale) : 10.5
                  ctx.font = `${isHover ? 600 : 500} ${fontSize}px "Geist Variable", system-ui, sans-serif`
                  ctx.textAlign = 'center'
                  ctx.textBaseline = 'top'
                  const label = isHover ? n.title : fitText(ctx, n.title, n.label ?? SPACING - 10)
                  const ty = y + n.r + 4
                  ctx.lineJoin = 'round'
                  ctx.lineWidth = fontSize * 0.32
                  ctx.strokeStyle = surface
                  ctx.strokeText(label, x, ty)
                  ctx.fillStyle = ink
                  ctx.fillText(label, x, ty)
                }
              }
              ctx.globalAlpha = 1
            }}
          />
        )}

        <div
          aria-live="polite"
          className="pointer-events-none absolute bottom-2 left-2 max-w-[calc(100%-1rem)] rounded-lg border border-foreground/12 bg-popover px-2.5 py-1.5 text-xs text-popover-foreground transition-opacity duration-150"
          style={{ opacity: hovered ? 1 : 0 }}
        >
          {hovered?.kind === 'payer' && (
            <>
              <span className="font-medium">{hovered.title}</span>
              <span className="text-muted-foreground">
                {' · '}paga {hovered.count} {hovered.count === 1 ? 'assinatura ativa' : 'assinaturas ativas'} · {formatBRL(hovered.monthly)}/mês
              </span>
            </>
          )}
          {hovered?.kind === 'sub' && hovered.row && (
            <>
              <span className="font-medium">{hovered.title}</span>
              <span className="text-muted-foreground">
                {' · '}
                {hovered.inactive ? (hovered.row.sub.status === 'paused' ? 'pausada' : 'cancelada') : `${formatBRL(hovered.monthly)}/mês`}
                {sharedNames(hovered.row).length > 0 && ` · dividida com ${sharedNames(hovered.row).join(', ')}`}
                {hovered.row.next && ` · cobra ${relativeDay(hovered.row.next, todayISO)}`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* a mesma informação em texto, para leitores de tela */}
      <ul className="sr-only">
        {groups.map((g) => (
          <li key={g.id}>
            {g.member?.name ?? 'Sem pagador'} paga: {g.rows.map((r) => `${r.note.title} (${r.sub.status === 'active' ? formatBRL(r.monthly) + ' por mês' : 'inativa'})`).join(', ')}.
          </li>
        ))}
      </ul>
    </div>
  )
}
