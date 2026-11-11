import { hashColor, normalizeHex } from '@/domain/color'
import type { Note } from '@/domain/types'
import { titleKey } from '@/domain/wikilinks'
import { brandBySlug, matchBrand } from './brands'
import { GENERIC_ICONS } from './genericIcons'

export type ResolvedIcon =
  | { kind: 'brand'; path: string; label: string }
  | { kind: 'generic'; d: string; label: string }
  | { kind: 'text'; text: string; label: string }
  | { kind: 'image'; src: string; label: string }

export interface SubscriptionLook {
  icon: ResolvedIcon
  /** Cor em #rrggbb do selo da assinatura. */
  color: string
  /** true quando ícone e cor vieram da escolha automática. */
  autoIcon: boolean
  autoColor: boolean
}

const genericByKey = new Map(GENERIC_ICONS.map((i) => [i.key, i]))

/**
 * Serviços conhecidos cujo logotipo não existe em nenhuma versão da biblioteca.
 * Em vez de um ícone genérico, ganham um selo tipográfico: as letras pelas quais
 * são reconhecidos, na cor da marca. Quem quiser o logotipo envia a imagem.
 */
const KNOWN: { aliases: string[]; text: string; color: string }[] = [
  { aliases: ['disney+', 'disney plus', 'disney'], text: 'D+', color: '#113ccf' },
  { aliases: ['amazon music'], text: 'music', color: '#25d1da' },
  { aliases: ['kindle', 'kindle unlimited'], text: 'kindle', color: '#ff9900' },
  { aliases: ['smart fit', 'smartfit'], text: 'SF', color: '#ffb612' },
  { aliases: ['gympass', 'wellhub'], text: 'W', color: '#f06449' },
  { aliases: ['globoplay'], text: 'gp', color: '#fb0234' },
  { aliases: ['telecine'], text: 'TC', color: '#e4002b' },
  { aliases: ['star+', 'star plus'], text: 'S+', color: '#c4126b' },
  { aliases: ['claro'], text: 'Claro', color: '#da291c' },
  { aliases: ['tim'], text: 'TIM', color: '#004691' },
  { aliases: ['vivo'], text: 'vivo', color: '#b6007a' },
  { aliases: ['oi'], text: 'oi', color: '#f8a100' },
  { aliases: ['alura'], text: 'a', color: '#2a7ae4' },
  { aliases: ['rappi'], text: 'R', color: '#ff441f' },
  { aliases: ['capcut'], text: 'CC', color: '#111111' },
]

function matchKnown(title: string) {
  const key = ` ${titleKey(title).replace(/[^a-z0-9+]+/g, ' ').trim()} `
  let best: { item: (typeof KNOWN)[number]; length: number } | null = null
  for (const item of KNOWN) {
    for (const alias of item.aliases) {
      if (key.includes(` ${alias} `) && (!best || alias.length > best.length)) best = { item, length: alias.length }
    }
  }
  return best?.item ?? null
}

/** Iniciais do nome: "Clube do café" → "CC", "Seguro residencial" → "SR", "Max" → "M". */
export function monogram(title: string): string {
  const words = title
    .trim()
    .split(/\s+/)
    .filter((w) => !/^(d[aeo]s?|e|the|of|\d+|gb|mb|tb)$/i.test(w) && /[\p{L}\p{N}]/u.test(w))
  if (words.length === 0) return '?'
  if (words.length === 1) {
    const w = words[0]
    return w.endsWith('+') && w.length > 1 ? `${w[0].toUpperCase()}+` : w[0].toUpperCase()
  }
  return (words[0][0] + words[1][0]).toUpperCase()
}

/** Ícone e cor de uma assinatura: a escolha do usuário, ou o automático pelo nome. */
export function subscriptionLook(note: Pick<Note, 'title' | 'subscription'>): SubscriptionLook {
  const sub = note.subscription
  const chosen = sub?.icon ?? null
  let icon: ResolvedIcon | null = null
  let suggested: string | null = null

  if (chosen === 'image' && sub?.image) {
    icon = { kind: 'image', src: sub.image, label: 'Imagem própria' }
  } else if (chosen?.startsWith('brand:')) {
    const b = brandBySlug(chosen.slice(6))
    if (b) {
      icon = { kind: 'brand', path: b.path, label: b.title }
      suggested = b.hex
    }
  } else if (chosen?.startsWith('icon:')) {
    const g = genericByKey.get(chosen.slice(5))
    if (g) icon = { kind: 'generic', d: g.d, label: g.label }
  } else if (chosen === 'letter') {
    icon = { kind: 'text', text: monogram(note.title), label: 'Iniciais' }
  }

  const autoIcon = icon === null
  const brand = matchBrand(note.title)
  const known = brand ? null : matchKnown(note.title)
  if (!icon) {
    if (brand) icon = { kind: 'brand', path: brand.path, label: brand.title }
    else if (known) icon = { kind: 'text', text: known.text, label: 'Selo da marca' }
    else icon = { kind: 'text', text: monogram(note.title), label: 'Iniciais' }
  }
  // a cor automática acompanha a marca reconhecida no nome, mesmo que o ícone tenha sido trocado
  suggested ??= brand?.hex ?? known?.color ?? null

  const own = normalizeHex(sub?.color ?? '')
  return {
    icon,
    color: own ?? suggested ?? hashColor(titleKey(note.title)),
    autoIcon,
    autoColor: !own,
  }
}

/** Tamanho de fonte relativo ao lado do selo, para o texto caber: 1 a 2 letras grandes, até 5 pequenas. */
export function textScale(text: string): number {
  const n = [...text].length
  return n <= 1 ? 0.5 : n === 2 ? 0.42 : n === 3 ? 0.33 : n === 4 ? 0.28 : 0.24
}

const pathCache = new Map<string, Path2D>()
const imageCache = new Map<string, HTMLImageElement>()

/**
 * Desenha o ícone centrado em (x, y) dentro de um círculo de diâmetro `box`.
 * `onLoad` é chamado quando uma imagem termina de carregar, para o grafo redesenhar.
 */
export function drawIcon(
  ctx: CanvasRenderingContext2D,
  icon: ResolvedIcon,
  x: number,
  y: number,
  box: number,
  ink: string,
  onLoad?: () => void,
) {
  ctx.save()
  if (icon.kind === 'image') {
    let img = imageCache.get(icon.src)
    if (!img) {
      img = new Image()
      img.onload = () => onLoad?.()
      img.src = icon.src
      imageCache.set(icon.src, img)
    }
    if (img.complete && img.naturalWidth > 0) {
      ctx.beginPath()
      ctx.arc(x, y, box / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, x - box / 2, y - box / 2, box, box)
    }
    ctx.restore()
    return
  }
  if (icon.kind === 'text') {
    ctx.fillStyle = ink
    ctx.font = `700 ${box * textScale(icon.text) * 1.05}px "Geist Variable", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(icon.text, x, y + box * 0.02)
    ctx.restore()
    return
  }
  const size = box * 0.56
  const source = icon.kind === 'brand' ? icon.path : icon.d
  let path = pathCache.get(source)
  if (!path) {
    path = new Path2D(source)
    pathCache.set(source, path)
  }
  ctx.translate(x - size / 2, y - size / 2)
  ctx.scale(size / 24, size / 24)
  if (icon.kind === 'brand') {
    ctx.fillStyle = ink
    ctx.fill(path)
  } else {
    ctx.strokeStyle = ink
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke(path)
  }
  ctx.restore()
}

const MAX_IMAGE_CHARS = 150_000

/**
 * Lê uma imagem escolhida pelo usuário, recorta em quadrado e reduz para 128 px.
 * O resultado é sempre reencodado aqui (WebP ou PNG), nunca o arquivo original.
 */
export async function fileToIcon(file: File): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  if (!file.type.startsWith('image/')) return { ok: false, error: 'Escolha um arquivo de imagem (PNG, JPG ou WebP).' }
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: 'A imagem passa de 8 MB. Escolha uma menor.' }
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return { ok: false, error: 'Não foi possível ler essa imagem. Tente outro arquivo.' }
  }
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return { ok: false, error: 'O navegador não conseguiu processar a imagem.' }
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 128, 128)
  bitmap.close()
  let dataUrl = canvas.toDataURL('image/webp', 0.86)
  if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/png')
  if (dataUrl.length > MAX_IMAGE_CHARS) dataUrl = canvas.toDataURL('image/jpeg', 0.8)
  if (dataUrl.length > MAX_IMAGE_CHARS) return { ok: false, error: 'A imagem ficou grande demais mesmo reduzida. Tente uma mais simples.' }
  return { ok: true, dataUrl }
}
