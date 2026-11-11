import { computeShares, equalSplit } from './split'
import { chargesBetween } from './subscriptions'
import type { AppData, CategoryId, Expense, ISODate, Note, Transaction } from './types'

export function transactionExpenses(transactions: Transaction[], from: ISODate, to: ISODate): Expense[] {
  return transactions
    .filter((t) => t.date >= from && t.date <= to)
    .map((t) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      amount: t.amount,
      category_id: t.category_id,
      payer_id: t.payer_id,
      shares: computeShares(t.amount, t.split),
      source: 'transaction' as const,
      icon: t.icon ?? null,
    }))
}

/** Cada cobrança de assinatura no período vira um gasto da categoria Assinaturas. */
export function subscriptionExpenses(notes: Note[], from: ISODate, to: ISODate): Expense[] {
  const out: Expense[] = []
  for (const note of notes) {
    const sub = note.subscription
    if (!sub || note.kind !== 'subscription') continue
    const participants = sub.shared_with.length ? sub.shared_with : [sub.payer_id]
    const shares = computeShares(sub.price, equalSplit(participants))
    for (const date of chargesBetween(sub, from, to)) {
      out.push({
        id: `${note.id}@${date}`,
        date,
        description: note.title,
        amount: sub.price,
        category_id: 'assinaturas',
        payer_id: sub.payer_id,
        shares,
        source: 'subscription',
        note_id: note.id,
      })
    }
  }
  return out
}

/** Transações + cobranças de assinatura, da mais recente para a mais antiga. */
export function allExpenses(data: AppData, from: ISODate, to: ISODate): Expense[] {
  return [
    ...transactionExpenses(data.transactions, from, to),
    ...subscriptionExpenses(data.notes, from, to),
  ].sort((a, b) => b.date.localeCompare(a.date) || a.description.localeCompare(b.description))
}

export function total(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0)
}

export function sumByCategory(expenses: Expense[]): Record<CategoryId, number> {
  const out = {
    moradia: 0,
    mercado: 0,
    contas: 0,
    transporte: 0,
    lazer: 0,
    saude: 0,
    assinaturas: 0,
    outros: 0,
  } satisfies Record<CategoryId, number>
  for (const e of expenses) out[e.category_id] += e.amount
  return out
}

/** Gasto acumulado dia a dia: índice 0 = dia 1. */
export function cumulativeByDay(expenses: Expense[], daysInMonth: number): number[] {
  const perDay: number[] = Array.from({ length: daysInMonth }, () => 0)
  for (const e of expenses) {
    const day = Number(e.date.slice(8, 10))
    if (day >= 1 && day <= daysInMonth) perDay[day - 1] += e.amount
  }
  let running = 0
  return perDay.map((v) => (running += v))
}
