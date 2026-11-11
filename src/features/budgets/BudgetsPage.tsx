import { Check, OctagonAlert, Pencil, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { AnimatedNumber } from '@/components/common/AnimatedNumber'
import { MonthSwitcher } from '@/components/common/MonthSwitcher'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CATEGORIES } from '@/domain/categories'
import { monthKey, monthLabel, monthRange, shiftMonth } from '@/domain/dates'
import { allExpenses, total } from '@/domain/expenses'
import { centsToInput, formatAxis, formatBRL, formatBRLRound, parseBRL } from '@/domain/money'
import type { CategoryId } from '@/domain/types'
import { cn } from '@/lib/utils'
import { useMonth, useToday } from '@/store/selectors'
import { useAppStore, useData } from '@/store/useAppStore'

function severity(ratio: number) {
  if (ratio >= 1) return { color: 'var(--critical)', icon: OctagonAlert, label: 'Estourou' }
  if (ratio >= 0.8) return { color: 'var(--warning)', icon: TriangleAlert, label: 'Perto do limite' }
  return { color: 'var(--brand)', icon: null, label: 'Dentro do limite' }
}

export function BudgetsPage() {
  const data = useData()
  const todayISO = useToday()
  const setBudget = useAppStore((s) => s.setBudget)
  const [month, setMonth] = useState(() => monthKey(todayISO))
  const current = useMonth(month)
  const [editing, setEditing] = useState<CategoryId | null>(null)
  const [draft, setDraft] = useState('')

  const limitOf = (id: CategoryId) => data.budgets.find((b) => b.category_id === id)?.limit ?? 0
  const budgetTotal = data.budgets.reduce((s, b) => s + b.limit, 0)
  const ratio = budgetTotal > 0 ? current.total / budgetTotal : 0
  const overall = severity(ratio)
  const withLimit = CATEGORIES.filter((c) => limitOf(c.id) > 0)

  const history = useMemo(() => {
    const thisMonth = monthKey(todayISO)
    return Array.from({ length: 6 }, (_, i) => {
      const m = shiftMonth(thisMonth, i - 5)
      const { from, to } = monthRange(m)
      return {
        month: m,
        label: monthLabel(m, 'MMM').replace('.', ''),
        total: total(allExpenses(data, from, m === thisMonth ? todayISO : to)),
        partial: m === thisMonth,
      }
    })
  }, [data, todayISO])

  const save = (id: CategoryId) => {
    const value = draft.trim() === '' ? 0 : parseBRL(draft)
    if (value === null) {
      toast.error('Valor inválido', { description: 'Digite um limite como 1.500 ou 1500,00.' })
      return
    }
    setBudget(id, value)
    setEditing(null)
  }

  return (
    <>
      <PageHeader
        title="Orçamentos"
        description="Um teto mensal por categoria. O aviso aparece aos 80% e de novo quando o limite é ultrapassado."
        actions={<MonthSwitcher month={month} onChange={setMonth} />}
      />

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <section aria-label="Resumo do orçamento" className="flex flex-col rounded-2xl bg-brand-deep p-6 text-on-brand lg:col-span-5">
          <p className="eyebrow !text-white/75">total de {monthLabel(month, 'MMMM')}</p>
          <p className="mt-2 text-[2.75rem] leading-none font-semibold tracking-[-0.03em]">
            <span className="sr-only">{formatBRLRound(current.total)}</span>
            <span aria-hidden="true">
              <AnimatedNumber value={Math.round(current.total / 100)} format={(v) => `R$ ${v.toLocaleString('pt-BR')}`} />
            </span>
          </p>
          <p className="mt-2 text-sm text-white/80">
            {budgetTotal > 0 ? (
              <>
                de <span className="num font-medium text-white">{formatBRLRound(budgetTotal)}</span> planejados ·{' '}
                {Math.round(ratio * 100)}% usado
              </>
            ) : (
              'Nenhum limite definido ainda.'
            )}
          </p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
            <div
              className="h-full origin-left rounded-full transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)]"
              style={{ background: ratio >= 0.8 ? overall.color : 'var(--lime)', transform: `scaleX(${Math.min(1, ratio)})` }}
            />
          </div>
          {current.isCurrent && budgetTotal > 0 && (
            <p className="mt-3 text-sm text-white/80">
              {ratio < 1
                ? `Restam ${formatBRL(budgetTotal - current.total)} para ${current.days - current.dayOfMonth} dias — cerca de ${formatBRL(Math.max(0, Math.round((budgetTotal - current.total) / Math.max(1, current.days - current.dayOfMonth))))} por dia.`
                : `A casa passou ${formatBRL(current.total - budgetTotal)} do planejado.`}
            </p>
          )}
          {budgetTotal > 0 && (
            <dl className="mt-auto grid grid-cols-2 gap-4 border-t border-white/15 pt-4 text-sm">
              <div>
                <dt className="text-xs text-white/75">Categorias dentro do limite</dt>
                <dd className="num mt-0.5 text-lg font-semibold">
                  {withLimit.filter((c) => current.byCategory[c.id] <= limitOf(c.id)).length} de {withLimit.length}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-white/75">{current.isCurrent ? 'Fração do mês já corrida' : 'Resultado do mês'}</dt>
                <dd className="num mt-0.5 text-lg font-semibold">
                  {current.isCurrent
                    ? `${Math.round((current.dayOfMonth / current.days) * 100)}%`
                    : ratio <= 1
                      ? `${formatBRLRound(budgetTotal - current.total)} de folga`
                      : `${formatBRLRound(current.total - budgetTotal)} acima`}
                </dd>
              </div>
            </dl>
          )}
        </section>

        <section aria-label="Histórico de seis meses" className="rounded-2xl border border-border bg-card p-5 lg:col-span-7">
          <p className="eyebrow">gasto total · últimos 6 meses</p>
          <div className="mt-2 h-52">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 560, height: 208 }}>
              <BarChart data={history} margin={{ top: 22, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--axis)' }} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} tickMargin={6} />
                <YAxis width={44} tickLine={false} axisLine={false} tickCount={4} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} tickFormatter={formatAxis} />
                <Tooltip
                  cursor={{ fill: 'var(--grid)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const row = payload[0].payload as (typeof history)[number]
                    return (
                      <div className="rounded-lg border border-foreground/15 bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
                        <p className="num text-sm font-semibold">{formatBRL(row.total)}</p>
                        <p className="text-muted-foreground first-letter:uppercase">
                          {monthLabel(row.month)}
                          {row.partial ? ' · mês em andamento' : ''}
                        </p>
                      </div>
                    )
                  }}
                />
                {budgetTotal > 0 && (
                  <ReferenceLine
                    y={budgetTotal}
                    stroke="var(--muted-foreground)"
                    strokeDasharray="4 4"
                    label={{ value: 'Orçamento atual', position: 'insideTopRight', fill: 'var(--muted-foreground)', fontSize: 12, dy: -4 }}
                  />
                )}
                <Bar dataKey="total" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={700}>
                  {history.map((h) => (
                    <Cell key={h.month} fill="var(--brand)" fillOpacity={h.partial ? 0.55 : 1} />
                  ))}
                  <LabelList
                    dataKey="total"
                    position="top"
                    formatter={(v) => formatAxis(Number(v))}
                    style={{ fill: 'var(--foreground)', fontSize: 12 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs text-faint">A barra mais clara é o mês em andamento.</p>
        </section>

        <section aria-label="Limites por categoria" className="rounded-2xl border border-border bg-card lg:col-span-12">
          <ul>
            {CATEGORIES.map((c) => {
              const spent = current.byCategory[c.id]
              const limit = limitOf(c.id)
              const r = limit > 0 ? spent / limit : 0
              const s = severity(r)
              const isEditing = editing === c.id
              return (
                <li key={c.id} className="flex flex-col gap-2.5 border-t border-border px-5 py-4 first:border-t-0 md:grid md:grid-cols-[13rem_1fr_15rem] md:items-center md:gap-x-4">
                  <div className="flex items-center gap-2.5">
                    <span className="size-2.5 rounded-[3px]" style={{ background: c.color }} />
                    <span className="font-medium">{c.name}</span>
                    {limit > 0 && s.icon && (
                      <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground md:ml-0">
                        <s.icon className="size-3.5" style={{ color: s.color }} /> {s.label}
                      </span>
                    )}
                  </div>

                  <div>
                    {limit > 0 ? (
                      <div
                        className="h-2 overflow-hidden rounded-full bg-foreground/10"
                        role="meter"
                        aria-label={`${c.name}: ${Math.round(r * 100)}% do limite`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.min(100, Math.round(r * 100))}
                      >
                        <div
                          className="h-full origin-left rounded-full transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)]"
                          style={{ background: s.color, transform: `scaleX(${Math.min(1, r)})` }}
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-faint">Sem limite definido</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 md:justify-end">
                    {isEditing ? (
                      <form
                        className="flex items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault()
                          save(c.id)
                        }}
                      >
                        <span className="text-xs text-muted-foreground">R$</span>
                        <Input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                          inputMode="decimal"
                          aria-label={`Limite mensal de ${c.name}`}
                          className="num ctl-sm w-28 text-right"
                        />
                        <Button type="submit" size="icon-sm" aria-label="Salvar limite">
                          <Check />
                        </Button>
                      </form>
                    ) : (
                      <>
                        <p className="num text-sm md:text-right">
                          <span className="font-semibold">{formatBRL(spent)}</span>
                          <span className={cn('text-muted-foreground', limit === 0 && 'hidden')}> de {formatBRLRound(limit)}</span>
                        </p>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Editar limite de ${c.name}`}
                          onClick={() => {
                            setDraft(limit > 0 ? centsToInput(limit) : '')
                            setEditing(c.id)
                          }}
                        >
                          <Pencil />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </>
  )
}
