import type { Expense, ID, Settlement } from './types'

export interface Transfer {
  from_id: ID
  to_id: ID
  amount: number
}

/**
 * Saldo de cada morador em centavos.
 * Positivo: a casa deve a ele. Negativo: ele deve à casa.
 */
export function computeBalances(
  memberIds: ID[],
  expenses: Expense[],
  settlements: Settlement[],
): Record<ID, number> {
  const balance: Record<ID, number> = Object.fromEntries(memberIds.map((id) => [id, 0]))
  const add = (id: ID, value: number) => {
    balance[id] = (balance[id] ?? 0) + value
  }
  for (const e of expenses) {
    add(e.payer_id, e.amount)
    for (const [id, share] of Object.entries(e.shares)) add(id, -share)
  }
  for (const s of settlements) {
    add(s.from_id, s.amount)
    add(s.to_id, -s.amount)
  }
  return balance
}

/**
 * Transferências que zeram os saldos, casando sempre o maior devedor com o
 * maior credor. Gera no máximo (moradores − 1) transferências.
 */
export function simplifyDebts(balances: Record<ID, number>): Transfer[] {
  const creditors = Object.entries(balances)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, v }))
  const debtors = Object.entries(balances)
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, v: -v }))
  const byAmount = (a: { id: ID; v: number }, b: { id: ID; v: number }) =>
    b.v - a.v || a.id.localeCompare(b.id)

  const transfers: Transfer[] = []
  while (creditors.length && debtors.length) {
    creditors.sort(byAmount)
    debtors.sort(byAmount)
    const c = creditors[0]
    const d = debtors[0]
    const amount = Math.min(c.v, d.v)
    transfers.push({ from_id: d.id, to_id: c.id, amount })
    c.v -= amount
    d.v -= amount
    if (c.v === 0) creditors.shift()
    if (d.v === 0) debtors.shift()
  }
  return transfers
}
