/**
 * Disposição do grafo "quem paga": cada pagador no centro do seu grupo e as
 * assinaturas em anel ao redor. Tudo em unidades do grafo, então as distâncias
 * valem para qualquer zoom: grupos não se tocam de longe e, de perto, ficam a
 * um espaço fixo um do outro.
 */
export interface RingItem {
  id: string
  /** Raio do círculo do item. */
  r: number
}

export interface PlacedItem extends RingItem {
  x: number
  y: number
  /** Largura máxima do rótulo embaixo do item, sem invadir o vizinho. */
  label: number
}

export interface PlacedCluster {
  id: string
  x: number
  y: number
  /** Raio que contém o grupo inteiro, com os rótulos. */
  extent: number
  items: PlacedItem[]
}

export const CENTER_R = 24
/** Distância entre vizinhos no anel: cabe o círculo e o rótulo embaixo dele. */
export const SPACING = 84
const MIN_RING = 86
const RING_STEP = 74
const LABEL_ROOM = 22
/** Folga entre dois grupos. */
export const CLUSTER_GAP = 44
const SINGLE_RING_MAX = 10

function ringRadius(count: number, min: number): number {
  return Math.max(min, (count * SPACING) / (2 * Math.PI))
}

/** Itens de um grupo em um anel (ou dois, quando são muitos), a partir do topo, em sentido horário. */
export function placeRing(items: RingItem[]): { items: PlacedItem[]; extent: number } {
  if (items.length === 0) return { items: [], extent: CENTER_R + LABEL_ROOM + 16 }
  const rings: RingItem[][] = []
  if (items.length <= SINGLE_RING_MAX) rings.push(items)
  else {
    const inner = Math.max(4, Math.round(items.length * 0.4))
    rings.push(items.slice(0, inner), items.slice(inner))
  }
  const placed: PlacedItem[] = []
  let radius = 0
  let extent = 0
  rings.forEach((ring, index) => {
    radius = ringRadius(ring.length, index === 0 ? MIN_RING : radius + RING_STEP)
    // o segundo anel começa meio passo adiante, para não alinhar com o primeiro
    const offset = index === 0 ? 0 : Math.PI / ring.length
    // distância em linha reta até o vizinho do anel: é o espaço que o rótulo pode ocupar
    const chord = ring.length > 1 ? 2 * radius * Math.sin(Math.PI / ring.length) : radius * 2
    const label = Math.max(SPACING - 10, Math.min(112, chord - 10))
    ring.forEach((item, i) => {
      const angle = -Math.PI / 2 + offset + (i * 2 * Math.PI) / ring.length
      placed.push({ ...item, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, label })
    })
    extent = radius + Math.max(...ring.map((i) => i.r)) + LABEL_ROOM
  })
  return { items: placed, extent }
}

/**
 * Distribui os grupos em linhas. `aspect` é largura ÷ altura da área de desenho:
 * escolhe-se o número de colunas que deixa o conjunto maior na tela.
 */
export function layoutClusters(groups: { id: string; items: RingItem[] }[], aspect: number): { clusters: PlacedCluster[]; width: number; height: number } {
  const rings = groups.map((g) => ({ id: g.id, ...placeRing(g.items) }))
  if (rings.length === 0) return { clusters: [], width: 0, height: 0 }
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1

  let best: { clusters: PlacedCluster[]; width: number; height: number; scale: number } | null = null
  for (let cols = 1; cols <= rings.length; cols++) {
    const rows: (typeof rings)[] = []
    for (let i = 0; i < rings.length; i += cols) rows.push(rings.slice(i, i + cols))
    const rowWidths = rows.map((row) => row.reduce((s, c) => s + c.extent * 2, 0) + CLUSTER_GAP * (row.length - 1))
    const rowHeights = rows.map((row) => Math.max(...row.map((c) => c.extent * 2)))
    const width = Math.max(...rowWidths)
    const height = rowHeights.reduce((s, h) => s + h, 0) + CLUSTER_GAP * (rows.length - 1)
    const scale = Math.min(safeAspect / width, 1 / height)
    if (best && scale <= best.scale) continue
    const clusters: PlacedCluster[] = []
    let y = -height / 2
    rows.forEach((row, r) => {
      let x = -rowWidths[r] / 2
      const cy = y + rowHeights[r] / 2
      for (const c of row) {
        const cx = x + c.extent
        clusters.push({ id: c.id, x: cx, y: cy, extent: c.extent, items: c.items.map((i) => ({ ...i, x: i.x + cx, y: i.y + cy })) })
        x += c.extent * 2 + CLUSTER_GAP
      }
      y += rowHeights[r] + CLUSTER_GAP
    })
    best = { clusters, width, height, scale }
  }
  return { clusters: best!.clusters, width: best!.width, height: best!.height }
}
