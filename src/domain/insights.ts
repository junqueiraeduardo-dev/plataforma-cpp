import { CATEGORIES } from './categories'
import { daysBetween } from './dates'
import { sumByCategory } from './expenses'
import { formatBRL } from './money'
import type { Budget, Expense, ISODate } from './types'

export interface Insight {
  tone: 'good' | 'warning' | 'critical' | 'info'
  title: string
  detail: string
}

interface Input {
  /** Gastos do mês até hoje. */
  current: Expense[]
  /** Gastos do mês anterior inteiro; a comparação usa a fatia proporcional aos dias corridos. */
  previousMonth: Expense[]
  budgets: Budget[]
  upcoming: { title: string; date: ISODate; amount: number }[]
  todayISO: ISODate
  dayOfMonth: number
  daysInMonth: number
}

export function buildInsights(input: Input): Insight[] {
  const out: Insight[] = []
  const now = sumByCategory(input.current)
  const before = sumByCategory(input.previousMonth)
  const pace = input.dayOfMonth / input.daysInMonth
  const entries = new Map<string, number>()
  for (const e of input.current) entries.set(e.category_id, (entries.get(e.category_id) ?? 0) + 1)

  for (const b of input.budgets) {
    const spent = now[b.category_id]
    if (b.limit <= 0) continue
    const name = CATEGORIES.find((c) => c.id === b.category_id)?.name ?? b.category_id
    const ratio = spent / b.limit
    if (ratio >= 1) {
      out.push({
        tone: 'critical',
        title: `${name} estourou o orçamento`,
        detail: `${formatBRL(spent)} gastos de ${formatBRL(b.limit)} — ${formatBRL(spent - b.limit)} acima.`,
      })
    } else if (ratio >= 0.8 && (entries.get(b.category_id) ?? 0) >= 3) {
      // contas fixas (aluguel, condomínio) chegam perto do teto de uma vez só: não são alerta
      out.push({
        tone: 'warning',
        title: `${name} em ${Math.round(ratio * 100)}% do orçamento`,
        detail: `Restam ${formatBRL(b.limit - spent)} para ${input.daysInMonth - input.dayOfMonth} dias.`,
      })
    }
  }

  // maior variação frente ao ritmo do mês anterior (total do mês × fração de dias corridos)
  let biggest: { name: string; pct: number; diff: number } | null = null
  for (const c of CATEGORIES) {
    const a = Math.round(before[c.id] * pace)
    const b = now[c.id]
    // base pequena, conta fixa ou cobrança com data marcada distorcem o percentual
    if (c.id === 'assinaturas' || a < 10000 || (entries.get(c.id) ?? 0) < 3) continue
    const pct = (b - a) / a
    if (!biggest || Math.abs(pct) > Math.abs(biggest.pct)) biggest = { name: c.name, pct, diff: b - a }
  }
  if (biggest && Math.abs(biggest.pct) >= 0.1) {
    const up = biggest.pct > 0
    out.push({
      tone: up ? 'warning' : 'good',
      title: `${biggest.name} ${Math.round(Math.abs(biggest.pct) * 100)}% ${up ? 'acima' : 'abaixo'} do ritmo do mês passado`,
      detail: `${formatBRL(Math.abs(biggest.diff))} ${up ? 'a mais' : 'a menos'} do que a casa gastava a esta altura do mês.`,
    })
  }

  const soon = input.upcoming.filter((u) => {
    const d = daysBetween(input.todayISO, u.date)
    return d >= 0 && d <= 7
  })
  if (soon.length) {
    const sum = soon.reduce((s, u) => s + u.amount, 0)
    out.push({
      tone: 'info',
      title: `${soon.length} ${soon.length === 1 ? 'renovação' : 'renovações'} nos próximos 7 dias`,
      detail: `${soon.map((u) => u.title).slice(0, 3).join(', ')}${soon.length > 3 ? '…' : ''} — ${formatBRL(sum)} no total.`,
    })
  }

  const order = { critical: 0, warning: 1, info: 2, good: 3 }
  return out.sort((a, b) => order[a.tone] - order[b.tone])
}
