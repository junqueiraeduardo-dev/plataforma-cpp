import { getDaysInMonth } from 'date-fns'
import { useMemo } from 'react'
import { fromISO, monthKey, monthRange, shiftMonth, today, type MonthKey } from '@/domain/dates'
import { mix } from '@/domain/color'
import { allExpenses, sumByCategory, total } from '@/domain/expenses'
import { computeBalances, simplifyDebts } from '@/domain/settle'
import { monthlyCost, nextCharge, yearlyCost } from '@/domain/subscriptions'
import { categoryColors, effectiveTheme, themeIsDark } from '@/domain/theme'
import type { AppData, ISODate, Note, SubscriptionProps } from '@/domain/types'
import { useData } from './useAppStore'

export function useToday(): ISODate {
  return useMemo(() => today(), [])
}

/** Gastos de um mês (transações + cobranças de assinatura), com totais. */
export function useMonth(month: MonthKey) {
  const data = useData()
  const todayISO = useToday()
  return useMemo(() => {
    const { from, to } = monthRange(month)
    const isCurrent = month === monthKey(todayISO)
    const expenses = allExpenses(data, from, isCurrent ? todayISO : to)
    const days = getDaysInMonth(fromISO(from))
    return {
      month,
      from,
      to,
      isCurrent,
      days,
      dayOfMonth: isCurrent ? Number(todayISO.slice(8, 10)) : days,
      expenses,
      total: total(expenses),
      byCategory: sumByCategory(expenses),
    }
  }, [data, month, todayISO])
}

/** Mesmo intervalo de dias do mês anterior, para comparar períodos iguais. */
export function usePreviousSamePeriod(month: MonthKey, dayOfMonth: number) {
  const data = useData()
  return useMemo(() => {
    const prev = shiftMonth(month, -1)
    const { from, to } = monthRange(prev)
    const lastDay = Number(to.slice(8, 10))
    const until = `${prev}-${String(Math.min(dayOfMonth, lastDay)).padStart(2, '0')}`
    const expenses = allExpenses(data, from, until)
    return { expenses, total: total(expenses) }
  }, [data, month, dayOfMonth])
}

export interface SubscriptionRow {
  note: Note
  sub: SubscriptionProps
  monthly: number
  yearly: number
  next: ISODate | null
}

export function subscriptionRows(data: AppData, todayISO: ISODate): SubscriptionRow[] {
  return data.notes
    .filter((n): n is Note & { subscription: SubscriptionProps } => n.kind === 'subscription' && !!n.subscription)
    .map((note) => ({
      note,
      sub: note.subscription,
      monthly: monthlyCost(note.subscription),
      yearly: yearlyCost(note.subscription),
      next: nextCharge(note.subscription, todayISO),
    }))
}

export function useSubscriptions() {
  const data = useData()
  const todayISO = useToday()
  return useMemo(() => {
    const rows = subscriptionRows(data, todayISO)
    const active = rows.filter((r) => r.sub.status === 'active')
    const upcoming = active
      .filter((r) => r.next)
      .sort((a, b) => a.next!.localeCompare(b.next!))
    return {
      rows,
      active,
      upcoming,
      monthly: active.reduce((s, r) => s + r.monthly, 0),
      yearly: active.reduce((s, r) => s + r.yearly, 0),
      inactive: rows.filter((r) => r.sub.status !== 'active'),
    }
  }, [data, todayISO])
}

/** Saldos acumulados desde sempre e as transferências que os zeram. */
export function useBalances() {
  const data = useData()
  const todayISO = useToday()
  return useMemo(() => {
    const expenses = allExpenses(data, '0000-01-01', todayISO)
    const ids = data.members.map((m) => m.id)
    const balances = computeBalances(ids, expenses, data.settlements)
    const paid: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]))
    const owed: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]))
    for (const e of expenses) {
      paid[e.payer_id] = (paid[e.payer_id] ?? 0) + e.amount
      for (const [id, share] of Object.entries(e.shares)) owed[id] = (owed[id] ?? 0) + share
    }
    return { balances, transfers: simplifyDebts(balances), paid, owed }
  }, [data, todayISO])
}

export function useMember() {
  const members = useData().members
  return useMemo(() => {
    const map = new Map(members.map((m) => [m.id, m]))
    return (id: string) => map.get(id)
  }, [members])
}

/** Cores efetivas em hexadecimal, para o que não lê variáveis CSS (canvas, WebGL, cálculo de contraste). */
export function useThemeColors() {
  const settings = useData().settings
  return useMemo(() => {
    const theme = effectiveTheme(settings)
    return {
      ...theme,
      dark: themeIsDark(settings),
      mutedForeground: mix(theme.foreground, theme.background, 0.28),
      faint: mix(theme.foreground, theme.background, 0.46),
      categories: categoryColors(settings),
    }
  }, [settings])
}
