import { itemKey } from '@/domain/shopping'
import type { MarketSection, Product } from '@/domain/types'
import { titleKey } from '@/domain/wikilinks'
import { CATALOG } from './catalog'

export interface ParsedItem {
  name: string
  quantity: number
  /** Medida escrita junto ("2 kg", "500 g"), quando houver. */
  detail: string | null
}

const UNIT =
  '(?:kg|g|gr|gramas?|quilos?|l|lt|ml|litros?|un|und|unidades?|cx|caixas?|pct|pcts?|pacotes?|dz|duzias?|dúzias?|latas?|garrafas?|sacos?|bandejas?|ma[cç]os?|potes?|fardos?)'
const WITH_UNIT = new RegExp(`^(\\d{1,4}(?:[.,]\\d{1,2})?)\\s*(${UNIT})\\b\\.?\\s+(?:de\\s+)?(.+)$`, 'i')
const LIST_MARKER = /^\s*(?:[-*•–—]|\[\s?[xX]?\s?\]|\d{1,2}[.)])\s+/

function tidy(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 60)
  return clean ? clean[0].toUpperCase() + clean.slice(1) : ''
}

function parseOne(raw: string): ParsedItem | null {
  const text = raw.replace(LIST_MARKER, '').replace(/\s+/g, ' ').trim()
  if (!text) return null
  let m: RegExpMatchArray | null

  // "2 kg tomate", "500g de queijo": a medida vira detalhe e a quantidade é 1
  if ((m = text.match(WITH_UNIT))) {
    const name = tidy(m[3])
    return name ? { name, quantity: 1, detail: `${m[1]} ${m[2].toLowerCase()}` } : null
  }
  // "3x iogurte", "3 x iogurte"
  if ((m = text.match(/^(\d{1,3})\s*x\s+(.+)$/i))) return item(m[2], m[1])
  // "leite x2", "leite 2x"
  if ((m = text.match(/^(.+?)\s+(?:x\s*(\d{1,3})|(\d{1,3})\s*x)$/i))) return item(m[1], m[2] ?? m[3])
  // "leite (2)"
  if ((m = text.match(/^(.+?)\s*\((\d{1,3})\)$/))) return item(m[1], m[2])
  // "2 leite"
  if ((m = text.match(/^(\d{1,3})\s+(\D.*)$/))) return item(m[2], m[1])
  return item(text, '1')
}

function item(name: string, quantity: string): ParsedItem | null {
  const clean = tidy(name)
  if (!clean) return null
  return { name: clean, quantity: Math.min(999, Math.max(1, Number(quantity) || 1)), detail: null }
}

/**
 * Transforma o que foi digitado (ou colado) em itens. Aceita vários de uma vez,
 * separados por linha, vírgula ou ponto e vírgula. Repetidos na mesma entrada somam.
 */
export function parseItems(text: string): ParsedItem[] {
  // a vírgula decimal de uma medida ("1,5 kg") não separa itens
  const protectedText = text.replace(/(\d),(\d)/g, '$1\uE000$2')
  const out = new Map<string, ParsedItem>()
  for (const part of protectedText.split(/[\n;,]+/)) {
    const parsed = parseOne(part.replace(/\uE000/g, ','))
    if (!parsed) continue
    const key = itemKey(parsed.name, parsed.detail)
    const existing = out.get(key)
    if (existing) existing.quantity = Math.min(999, existing.quantity + parsed.quantity)
    else out.set(key, parsed)
  }
  return [...out.values()]
}

// plural simples → singular, para "bananas" achar "banana" e "ovos" achar "ovo"
const singular = (word: string) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word)
const words = (name: string) => titleKey(name).replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(Boolean).map(singular)

const CATALOG_WORDS = CATALOG.map((p) => ({ section: p.section, words: words(p.name) }))

const KEYWORDS: [RegExp, MarketSection][] = [
  [/\b(fruta|verdura|legume|salada|erva|tempero verde)/, 'hortifruti'],
  [/\b(pao|paes|bolo|rosca|croissant|sonho|broa)/, 'padaria'],
  [/\b(queijo|leite|iogurte|manteiga|requeijao|nata|coalhada|presunto|salame|peito de peru)/, 'laticinios'],
  [/\b(carne|frango|peixe|linguica|bife|file|costela|picanha|salsicha|camarao|porco|lombo)/, 'carnes'],
  [/\b(refri|refrigerante|suco|agua|cerveja|vinho|cha|isotonico|energetico|whisky|vodka|cachaca)/, 'bebidas'],
  [/\b(congelad|sorvete|picole|acai)/, 'congelados'],
  [/\b(sabao|detergente|limpa|limpador|desinfetante|esponja|amaciante|alvejante|vassoura|rodo|pano|lixo)/, 'limpeza'],
  [/\b(shampoo|xampu|sabonete|creme dental|pasta de dente|escova|desodorante|papel higienico|fralda|absorvente|hidratante|barbear)/, 'higiene'],
  [/\b(racao|areia|pilha|lampada|vela|fosforo|guardanapo|papel aluminio|filme plastico|petisco)/, 'casa'],
  [/\b(arroz|feijao|macarrao|farinha|acucar|sal|cafe|oleo|azeite|molho|biscoito|bolacha|cereal|chocolate|tempero|ovo|lata|conserva|granola|aveia)/, 'mercearia'],
]

/**
 * Seção provável de um item: primeiro o que a casa já definiu antes, depois o
 * dicionário de produtos (nome igual ou contido), depois palavras-chave.
 */
export function guessSection(name: string, memory: Pick<Product, 'name' | 'section'>[] = []): MarketSection {
  const key = titleKey(name)
  const remembered = memory.find((p) => titleKey(p.name) === key)
  if (remembered) return remembered.section

  const typed = words(name)
  if (typed.length === 0) return 'outros'
  const joined = ` ${typed.join(' ')} `
  let best: { section: MarketSection; score: number } | null = null
  for (const entry of CATALOG_WORDS) {
    const target = ` ${entry.words.join(' ')} `
    // "queijo muçarela fatiado" contém "queijo muçarela"; "queijo" está contido em "queijo muçarela"
    // quando o digitado é só parte do nome, vale mais se for o começo ("queijo" é Queijo muçarela, não Pão de queijo)
    const score = joined.includes(target) ? entry.words.length * 2 : target.includes(joined) ? typed.length + (target.startsWith(joined) ? 0.5 : 0) : 0
    if (score > 0 && (!best || score > best.score)) best = { section: entry.section, score }
  }
  if (best) return best.section

  const flat = typed.join(' ')
  return KEYWORDS.find(([re]) => re.test(flat))?.[1] ?? 'outros'
}

/**
 * Sugestões enquanto o usuário digita: primeiro o que a casa já usou (mais
 * usados na frente), depois o dicionário. Sem texto, só os frequentes da casa.
 */
export function suggest(query: string, memory: Product[], skip: Set<string>, limit = 6): { name: string; section: MarketSection; own: boolean }[] {
  const q = titleKey(query)
  const out: { name: string; section: MarketSection; own: boolean }[] = []
  const seen = new Set<string>()
  const push = (name: string, section: MarketSection, own: boolean) => {
    const key = titleKey(name)
    if (seen.has(key) || skip.has(key) || out.length >= limit) return
    seen.add(key)
    out.push({ name, section, own })
  }
  const starts = (name: string) => titleKey(name).startsWith(q)
  const contains = (name: string) => titleKey(name).includes(q)

  const mine = [...memory].sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0) || a.name.localeCompare(b.name, 'pt-BR'))
  if (!q) {
    for (const p of mine) push(p.name, p.section, true)
    return out
  }
  for (const p of mine) if (starts(p.name)) push(p.name, p.section, true)
  for (const p of CATALOG) if (starts(p.name)) push(p.name, p.section, false)
  for (const p of mine) if (contains(p.name)) push(p.name, p.section, true)
  for (const p of CATALOG) if (contains(p.name)) push(p.name, p.section, false)
  return out
}

export { itemKey }
