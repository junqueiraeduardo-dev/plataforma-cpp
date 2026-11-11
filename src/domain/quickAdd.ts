import { addDays } from 'date-fns'
import { fromISO, toISO } from './dates'
import { matchRule } from './expenseRules'
import type { CategoryId, ID, ISODate, Member } from './types'
import { titleKey } from './wikilinks'

export interface QuickAdd {
  description: string
  /** Centavos; null quando não há valor no texto. */
  amount: number | null
  date: ISODate
  category_id: CategoryId
  payer_id: ID | null
  /** O que foi encontrado no texto (o resto veio do padrão). */
  found: { amount: boolean; date: boolean; category: boolean; payer: boolean }
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
}

const MONEY = /^(?:r\$)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)$/

function toCents(token: string): number | null {
  const m = token.match(MONEY)
  if (!m) return null
  let s = m[1]
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (!/^\d+\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '')
  const value = Math.round(Number(s) * 100)
  return Number.isFinite(value) && value > 0 ? value : null
}

function clampDay(year: number, month: number, day: number): Date {
  const last = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, last))
}

/**
 * Lê uma frase curta como "pizza 89,90 ontem ana" e separa descrição, valor,
 * data, categoria e quem pagou. O que não estiver na frase assume o padrão
 * (hoje, primeiro morador, categoria pela descrição). Datas nunca caem no futuro.
 */
export function parseQuickAdd(text: string, context: { today: ISODate; members: Pick<Member, 'id' | 'name'>[] }): QuickAdd {
  const today = fromISO(context.today)
  const tokens = text
    .trim()
    // valor colado na palavra ("luz150", "uber23,40") vira duas partes
    .replace(/([a-zà-ÿ])(\d+(?:[.,]\d{1,2})?)(?=\s|$)/gi, '$1 $2')
    .split(/\s+/)
    .filter(Boolean)
  const keys = tokens.map((t) => titleKey(t.replace(/[.,;:!?]+$/, '')))
  const used = new Set<number>()

  // ---- data
  let date: Date | null = null
  for (let i = 0; i < keys.length && !date; i++) {
    const k = keys[i]
    if (k === 'hoje') date = today
    else if (k === 'ontem') date = addDays(today, -1)
    else if (k === 'anteontem') date = addDays(today, -2)
    else if (k.replace(/-feira$/, '') in WEEKDAYS) {
      const back = (today.getDay() - WEEKDAYS[k.replace(/-feira$/, '')] + 7) % 7
      date = addDays(today, -back)
    } else if (k === 'dia' && /^\d{1,2}$/.test(keys[i + 1] ?? '')) {
      const day = Number(keys[i + 1])
      if (day >= 1 && day <= 31) {
        let d = clampDay(today.getFullYear(), today.getMonth(), day)
        if (d > today) d = clampDay(today.getFullYear(), today.getMonth() - 1, day)
        date = d
        used.add(i + 1)
      }
    } else {
      const m = k.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/)
      if (m) {
        const day = Number(m[1])
        const month = Number(m[2])
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
          let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : today.getFullYear()
          let d = clampDay(year, month - 1, day)
          if (!m[3] && d > today) d = clampDay(--year, month - 1, day)
          if (d <= today) date = d
        }
      }
    }
    if (date) used.add(i)
  }

  // ---- valor: prefere o número com centavos; senão, o último número solto
  let amount: number | null = null
  let amountAt = -1
  const candidates = tokens
    .map((token, i) => {
      const raw = token.toLowerCase().replace(/[.,;:!?]+$/, '')
      return { i, raw, cents: used.has(i) ? null : toCents(raw) }
    })
    .filter((c) => c.cents !== null)
  const withCents = candidates.filter((c) => /[.,]\d{1,2}$/.test(c.raw) || c.raw.startsWith('r$'))
  const pick = withCents[withCents.length - 1] ?? candidates[candidates.length - 1]
  if (pick) {
    amount = pick.cents
    amountAt = pick.i
    used.add(pick.i)
    if (keys[pick.i - 1] === 'r$') used.add(pick.i - 1)
    if (keys[pick.i + 1] === 'reais' || keys[pick.i + 1] === 'real') used.add(pick.i + 1)
  }

  // ---- quem pagou: nome de morador, com ou sem "pagou" depois
  let payer_id: ID | null = null
  const memberKeys = context.members.map((m) => ({ id: m.id, words: titleKey(m.name).split(' ') }))
  for (let i = 0; i < keys.length && !payer_id; i++) {
    if (used.has(i)) continue
    for (const m of memberKeys.sort((a, b) => b.words.length - a.words.length)) {
      const slice = keys.slice(i, i + m.words.length).map((k) => k.replace(/^@/, ''))
      if (slice.length === m.words.length && slice.every((w, j) => w === m.words[j])) {
        // um nome no meio da descrição ("bolo da ana") não é quem pagou: precisa estar no fim ou antes de "pagou"
        const after = keys[i + m.words.length]
        const atEnd = keys.slice(i + m.words.length).every((_, j) => used.has(i + m.words.length + j))
        const explicit = after === 'pagou' || after === 'paga' || keys[i].startsWith('@')
        // "bolo da ana 30": o nome depois de "da/do/de/para" faz parte da descrição
        const possessive = i > 0 && !used.has(i - 1) && /^(da|do|de|para|pra|pro|com)$/.test(keys[i - 1])
        if (!explicit && (!atEnd || possessive)) continue
        payer_id = m.id
        for (let j = 0; j < m.words.length; j++) used.add(i + j)
        if (after === 'pagou' || after === 'paga') used.add(i + m.words.length)
        break
      }
    }
  }

  // ---- descrição: o que sobrou, sem as palavrinhas de ligação nas pontas
  const rest = tokens.filter((_, i) => !used.has(i))
  while (rest.length && /^(de|do|da|no|na|em|por|pra|para|-)$/i.test(rest[rest.length - 1])) rest.pop()
  // "paguei 200 de luz" → "Luz": o verbo e a ligação do começo não fazem parte do nome
  while (rest.length && /^(paguei|gastei|comprei|pago|gasto|compra|de|do|da|no|na|em|com|-)$/i.test(rest[0])) rest.shift()
  let description = rest.join(' ').replace(/[.,;:]+$/, '').trim()
  const rule = matchRule(description)
  if (!description) description = ''
  else description = description[0].toUpperCase() + description.slice(1)

  return {
    description,
    amount,
    date: toISO(date ?? today),
    category_id: rule?.category ?? 'outros',
    payer_id: payer_id ?? context.members[0]?.id ?? null,
    found: { amount: amountAt >= 0, date: date !== null, category: rule !== null, payer: payer_id !== null },
  }
}
