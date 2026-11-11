import { addDays, endOfMonth, format, parseISO, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { ISODate } from './types'

export function toISO(date: Date): ISODate {
  return format(date, 'yyyy-MM-dd')
}

export function today(): ISODate {
  return toISO(new Date())
}

export function fromISO(iso: ISODate): Date {
  return parseISO(iso)
}

export function shiftDay(iso: ISODate, delta: number): ISODate {
  return toISO(addDays(parseISO(iso), delta))
}

/** Mês no formato YYYY-MM. */
export type MonthKey = string

export function monthKey(iso: ISODate): MonthKey {
  return iso.slice(0, 7)
}

export function monthRange(month: MonthKey): { from: ISODate; to: ISODate } {
  const first = parseISO(`${month}-01`)
  return { from: toISO(startOfMonth(first)), to: toISO(endOfMonth(first)) }
}

export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return format(d, 'yyyy-MM')
}

export function monthLabel(month: MonthKey, pattern = "MMMM 'de' yyyy"): string {
  return format(parseISO(`${month}-01`), pattern, { locale: ptBR })
}

export function formatDate(iso: ISODate, pattern = "d 'de' MMM"): string {
  return format(parseISO(iso), pattern, { locale: ptBR })
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000)
}

/** "hoje", "amanhã", "em 5 dias", "há 2 dias". */
export function relativeDay(iso: ISODate, reference: ISODate = today()): string {
  const diff = daysBetween(reference, iso)
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'amanhã'
  if (diff === -1) return 'ontem'
  return diff > 0 ? `em ${diff} dias` : `há ${-diff} dias`
}
