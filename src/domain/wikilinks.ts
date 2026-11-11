import { monthlyCost } from './subscriptions'
import type { ID, Member, Note, NoteKind } from './types'

export interface Wikilink {
  target: string
  alias: string | null
  start: number
  end: number
}

export const WIKILINK_RE = /\[\[([^[\]|\n]+?)(?:\|([^[\]\n]+?))?\]\]/g

export function parseWikilinks(body: string): Wikilink[] {
  const out: Wikilink[] = []
  for (const m of body.matchAll(WIKILINK_RE)) {
    const target = m[1].trim()
    if (!target) continue
    out.push({
      target,
      alias: m[2]?.trim() || null,
      start: m.index,
      end: m.index + m[0].length,
    })
  }
  return out
}

/** Títulos são comparados sem diferenciar maiúsculas, acentos ou espaços extras. */
export function titleKey(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function findNoteByTitle(notes: Note[], title: string): Note | undefined {
  const key = titleKey(title)
  return notes.find((n) => titleKey(n.title) === key)
}

/**
 * Todos os destinos de uma nota: os [[links]] do texto e, nas assinaturas,
 * as propriedades (quem paga, quem divide, grupo e forma de pagamento).
 */
export function outgoingTargets(note: Note, members: Member[]): string[] {
  const targets = parseWikilinks(note.body).map((l) => l.target)
  const sub = note.subscription
  if (sub && note.kind === 'subscription') {
    const name = (id: ID) => members.find((m) => m.id === id)?.name
    for (const id of new Set([sub.payer_id, ...sub.shared_with])) {
      const n = name(id)
      if (n) targets.push(n)
    }
    if (sub.group.trim()) targets.push(sub.group.trim())
    if (sub.payment_method.trim()) targets.push(sub.payment_method.trim())
  }
  const seen = new Set<string>()
  const self = titleKey(note.title)
  return targets.filter((t) => {
    const key = titleKey(t)
    if (!key || key === self || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export interface Backlink {
  note: Note
  /** Trecho do texto em volta do link; vazio quando o vínculo vem de uma propriedade. */
  snippet: string
}

export function backlinksFor(note: Note, notes: Note[], members: Member[]): Backlink[] {
  const key = titleKey(note.title)
  const out: Backlink[] = []
  for (const other of notes) {
    if (other.id === note.id) continue
    if (!outgoingTargets(other, members).some((t) => titleKey(t) === key)) continue
    const link = parseWikilinks(other.body).find((l) => titleKey(l.target) === key)
    let snippet = ''
    if (link) {
      const from = Math.max(0, other.body.lastIndexOf('\n', link.start) + 1)
      const lineEnd = other.body.indexOf('\n', link.end)
      snippet = other.body
        .slice(from, lineEnd === -1 ? undefined : lineEnd)
        .replace(/^[\s>#*-]+/, '')
        .replace(WIKILINK_RE, (_m, t: string, a?: string) => a ?? t)
        .trim()
    }
    out.push({ note: other, snippet })
  }
  return out.sort((a, b) => a.note.title.localeCompare(b.note.title, 'pt-BR'))
}

export interface GraphNode {
  id: string
  title: string
  kind: NoteKind | 'ghost'
  note_id: ID | null
  /** Custo mensal em centavos (assinaturas ativas); 0 para os demais. */
  monthly: number
  degree: number
  inactive: boolean
}

export interface GraphLink {
  source: string
  target: string
}

export interface Graph {
  nodes: GraphNode[]
  links: GraphLink[]
}

/** Grafo do cofre. Links para notas que ainda não existem viram nós "fantasma". */
export function buildGraph(notes: Note[], members: Member[]): Graph {
  const nodes = new Map<string, GraphNode>()
  for (const note of notes) {
    const sub = note.kind === 'subscription' ? note.subscription : null
    nodes.set(titleKey(note.title), {
      id: titleKey(note.title),
      title: note.title,
      kind: note.kind,
      note_id: note.id,
      monthly: sub && sub.status === 'active' ? monthlyCost(sub) : 0,
      degree: 0,
      inactive: !!sub && sub.status !== 'active',
    })
  }
  // moradores, grupos e formas de pagamento vêm das propriedades das assinaturas:
  // existem mesmo sem nota própria, então não são links "ainda não criados"
  const memberKeys = new Set(members.map((m) => titleKey(m.name)))
  const groupKeys = new Set<string>()
  const paymentKeys = new Set<string>()
  for (const note of notes) {
    const sub = note.kind === 'subscription' ? note.subscription : null
    if (sub?.group.trim()) groupKeys.add(titleKey(sub.group))
    if (sub?.payment_method.trim()) paymentKeys.add(titleKey(sub.payment_method))
  }
  const links: GraphLink[] = []
  const seen = new Set<string>()
  for (const note of notes) {
    const source = titleKey(note.title)
    for (const target of outgoingTargets(note, members)) {
      const key = titleKey(target)
      if (!nodes.has(key)) {
        nodes.set(key, {
          id: key,
          title: target,
          kind: memberKeys.has(key) ? 'member' : groupKeys.has(key) ? 'group' : paymentKeys.has(key) ? 'payment' : 'ghost',
          note_id: null,
          monthly: 0,
          degree: 0,
          inactive: false,
        })
      }
      const pair = [source, key].sort().join('→')
      if (seen.has(pair)) continue
      seen.add(pair)
      links.push({ source, target: key })
      nodes.get(source)!.degree += 1
      nodes.get(key)!.degree += 1
    }
  }
  return { nodes: [...nodes.values()], links }
}

/** Recorte do grafo: a nota e seus vizinhos diretos. */
export function localGraph(graph: Graph, centerId: string): Graph {
  const keep = new Set<string>([centerId])
  for (const l of graph.links) {
    if (l.source === centerId) keep.add(l.target)
    if (l.target === centerId) keep.add(l.source)
  }
  return {
    nodes: graph.nodes.filter((n) => keep.has(n.id)).map((n) => ({ ...n })),
    links: graph.links
      .filter((l) => keep.has(l.source) && keep.has(l.target))
      .map((l) => ({ ...l })),
  }
}
