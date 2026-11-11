import { addDays, addMonths } from 'date-fns'
import { fromISO, toISO } from './dates'
import type { BillingCycle, ISODate, SubscriptionProps } from './types'

export const CYCLE_LABEL: Record<BillingCycle, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  yearly: 'Anual',
}

export const CYCLE_SUFFIX: Record<BillingCycle, string> = {
  weekly: '/sem',
  monthly: '/mês',
  quarterly: '/trim',
  yearly: '/ano',
}

const CYCLE_MONTHS: Record<Exclude<BillingCycle, 'weekly'>, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
}

/**
 * Data da n-ésima cobrança. Sempre calculada a partir da data inicial, para o
 * dia não "escorregar": início em 31/jan cobra 28/fev (ou 29) e volta a 31/mar.
 */
function occurrence(sub: SubscriptionProps, n: number): ISODate {
  const anchor = fromISO(sub.start_date)
  if (sub.cycle === 'weekly') return toISO(addDays(anchor, 7 * n))
  return toISO(addMonths(anchor, n * CYCLE_MONTHS[sub.cycle]))
}

/** Cobranças no intervalo [from, to], respeitando pausa ou cancelamento. */
export function chargesBetween(sub: SubscriptionProps, from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = []
  if (to < sub.start_date) return out
  for (let n = 0; n < 5000; n++) {
    const date = occurrence(sub, n)
    if (date > to) break
    if (sub.end_date && date >= sub.end_date) break
    if (date >= from) out.push(date)
  }
  return out
}

/** Próxima cobrança a partir de `reference` (inclusive); null se não está ativa. */
export function nextCharge(sub: SubscriptionProps, reference: ISODate): ISODate | null {
  if (sub.status !== 'active') return null
  for (let n = 0; n < 5000; n++) {
    const date = occurrence(sub, n)
    if (date >= reference) return date
  }
  return null
}

/** Custo normalizado por mês, em centavos. */
export function monthlyCost(sub: SubscriptionProps): number {
  switch (sub.cycle) {
    case 'weekly':
      return Math.round((sub.price * 52) / 12)
    case 'monthly':
      return sub.price
    case 'quarterly':
      return Math.round(sub.price / 3)
    case 'yearly':
      return Math.round(sub.price / 12)
  }
}

export function yearlyCost(sub: SubscriptionProps): number {
  switch (sub.cycle) {
    case 'weekly':
      return sub.price * 52
    case 'monthly':
      return sub.price * 12
    case 'quarterly':
      return sub.price * 4
    case 'yearly':
      return sub.price
  }
}
