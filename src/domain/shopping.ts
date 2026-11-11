import { titleKey } from './wikilinks'

/** Chave de um item na lista: mesmo nome e mesma medida somam quantidade em vez de duplicar. */
export function itemKey(name: string, detail: string | null | undefined): string {
  return `text:${titleKey(name)}${detail ? `|${titleKey(detail)}` : ''}`
}
