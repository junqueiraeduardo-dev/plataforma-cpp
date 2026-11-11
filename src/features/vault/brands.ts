import { titleKey } from '@/domain/wikilinks'
import { BRAND_DATA, type BrandData } from './brandData'

export type Brand = BrandData

export const BRANDS: Brand[] = BRAND_DATA

const bySlug = new Map(BRANDS.map((b) => [b.slug, b]))

export function brandBySlug(slug: string): Brand | undefined {
  return bySlug.get(slug)
}

/**
 * Reconhece a marca pelo nome da assinatura. O apelido precisa aparecer como
 * palavra inteira ("Max" casa com "Max", não com "Maxmilhas"), e o apelido mais
 * longo vence ("YouTube Music" antes de "YouTube").
 */
export function matchBrand(title: string): Brand | null {
  const key = ` ${titleKey(title).replace(/[^a-z0-9+]+/g, ' ').trim()} `
  let best: { brand: Brand; length: number } | null = null
  for (const b of BRANDS) {
    for (const alias of b.aliases) {
      if (key.includes(` ${alias} `) && (!best || alias.length > best.length)) best = { brand: b, length: alias.length }
    }
  }
  return best?.brand ?? null
}
