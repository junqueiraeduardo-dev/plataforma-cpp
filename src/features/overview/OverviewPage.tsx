import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesColumn,
  CircleCheck,
  Info,
  OctagonAlert,
  Table2,
  TriangleAlert,
} from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CategoryBar } from '@/components/charts/CategoryBar'
import type { SpendPoint } from '@/components/charts/SpendChart'
import { AnimatedNumber } from '@/components/common/AnimatedNumber'
import { AuroraBackdrop } from '@/components/common/AuroraBackdrop'
import { BentoCell } from '@/components/common/BentoCell'
import { EmptyState } from '@/components/common/EmptyState'
import { MemberAvatar } from '@/components/common/MemberAvatar'
import { MonthSwitcher } from '@/components/common/MonthSwitcher'
import { PageHeader } from '@/components/common/PageHeader'
import { Swap } from '@/components/common/Swap'
import AnimatedList from '@/components/reactbits/AnimatedList'
import { AnimatedCircularProgressBar } from '@/components/ui/animated-circular-progress-bar'
import { Button } from '@/components/ui/button'
import { CATEGORIES, category } from '@/domain/categories'
import { formatDate, monthKey, monthLabel, relativeDay, shiftMonth } from '@/domain/dates'
import { cumulativeByDay } from '@/domain/expenses'
import { buildInsights, type Insight } from '@/domain/insights'
import { formatBRL, formatBRLRound } from '@/domain/money'
import { useBalances, useMember, useMonth, usePreviousSamePeriod, useSubscriptions, useThemeColors, useToday } from '@/store/selectors'
import { useData } from '@/store/useAppStore'
import { useUi } from '@/store/useUi'
import { ExpenseIcon } from '@/features/transactions/ExpenseIcon'
import { SubscriptionIcon } from '@/features/vault/SubscriptionIcon'

// a biblioteca de gráficos é pesada: chega depois do primeiro desenho da tela
const SpendChart = lazy(() => import('@/components/charts/SpendChart').then((m) => ({ default: m.SpendChart })))

const TONE = {
  critical: { icon: OctagonAlert, color: 'var(--critical)', label: 'Crítico' },
  warning: { icon: TriangleAlert, color: 'var(--warning)', label: 'Atenção' },
  info: { icon: Info, color: 'var(--brand)', label: 'Aviso' },
  good: { icon: CircleCheck, color: 'var(--good)', label: 'Boa notícia' },
} satisfies Record<Insight['tone'], unknown>

export function OverviewPage() {
  const data = useData()
  const todayISO = useToday()
  const navigate = useNavigate()
  const openNew = useUi((s) => s.openNewTransaction)
  const member = useMember()
  const theme = useThemeColors()
  const [month, setMonthRaw] = useState(() => monthKey(todayISO))
  // direção da troca de mês: o conteúdo novo entra pelo lado para onde se navegou
  const [dir, setDir] = useState(0)
  const setMonth = (next: string) => {
    setDir(next > month ? 1 : -1)
    setMonthRaw(next)
  }
  const [view, setView] = useState<'chart' | 'table'>('chart')

  const current = useMonth(month)
  const previousFull = useMonth(shiftMonth(month, -1))
  const previousSame = usePreviousSamePeriod(month, current.dayOfMonth)
  const subs = useSubscriptions()
  const { transfers } = useBalances()

  const budgetTotal = data.budgets.reduce((s, b) => s + b.limit, 0)
  const used = budgetTotal > 0 ? current.total / budgetTotal : 0
  const usedPct = Math.round(used * 100)
  const left = budgetTotal - current.total
  const daysLeft = current.days - current.dayOfMonth

  const delta = previousSame.total > 0 ? (current.total - previousSame.total) / previousSame.total : null

  const series: SpendPoint[] = useMemo(() => {
    const now = cumulativeByDay(current.expenses, current.days)
    const before = cumulativeByDay(previousFull.expenses, previousFull.days)
    return Array.from({ length: current.days }, (_, i) => ({
      day: i + 1,
      current: i < current.dayOfMonth ? now[i] : null,
      previous: i < before.length ? before[i] : null,
    }))
  }, [current, previousFull])

  const upcoming = subs.upcoming.slice(0, 5)
  const insights = useMemo(
    () =>
      current.isCurrent
        ? buildInsights({
            current: current.expenses,
            previousMonth: previousFull.expenses,
            budgets: data.budgets,
            upcoming: subs.upcoming.map((r) => ({ title: r.note.title, date: r.next!, amount: r.sub.price })),
            todayISO,
            dayOfMonth: current.dayOfMonth,
            daysInMonth: current.days,
          })
        : [],
    [current, previousFull.expenses, data.budgets, subs.upcoming, todayISO],
  )

  const recent = current.expenses.slice(0, 7)
  const ringColor = used >= 1 ? 'var(--critical)' : used >= 0.8 ? 'var(--warning)' : 'var(--lime)'
  const currentLabel = monthLabel(month, 'MMMM')
  const previousLabel = monthLabel(shiftMonth(month, -1), 'MMMM')

  if (data.members.length === 0) {
    return (
      <>
        <PageHeader title="Visão geral" />
        <EmptyState
          title="A casa ainda não tem moradores"
          action={
            <Button asChild>
              <Link to="/moradores">Cadastrar moradores</Link>
            </Button>
          }
        >
          Cadastre quem mora na casa para registrar gastos e dividir as contas. Se preferir explorar primeiro, restaure os
          dados de exemplo em Ajustes.
        </EmptyState>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={current.isCurrent ? `Dia ${current.dayOfMonth} de ${current.days}` : 'Mês fechado'}
        description={
          current.isCurrent
            ? `${data.household.name} · faltam ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'} para fechar o mês.`
            : `${data.household.name} · resumo de ${monthLabel(month)}.`
        }
        actions={<MonthSwitcher month={month} onChange={setMonth} />}
      />

      {/* celular: 2 colunas, por prioridade; tablet: 4 colunas; computador: 12 colunas, na ordem do código */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-12 lg:gap-5" style={{ perspective: 1200 }}>
        {/* 1 — gasto do mês */}
        <BentoCell
          index={0}
          tilt={false}
          label="Gasto do mês"
          className="order-1 col-span-2 overflow-hidden border-transparent bg-brand-deep p-0 text-on-brand hover:border-transparent md:col-span-4 lg:order-none lg:col-span-7 lg:row-span-2"
        >
          <AuroraBackdrop className="pointer-events-none absolute inset-x-0 top-0 h-56 [mask-image:linear-gradient(#000_35%,transparent)]" />
          <div className="relative flex flex-1 flex-col p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <p className="eyebrow !text-white/75">gasto em {currentLabel}</p>
              <div className="flex rounded-lg bg-black/25 p-0.5" role="group" aria-label="Formato de exibição">
                {(
                  [
                    ['chart', ChartNoAxesColumn, 'Gráfico'],
                    ['table', Table2, 'Tabela'],
                  ] as const
                ).map(([key, Icon, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setView(key)}
                    aria-pressed={view === key}
                    aria-label={label}
                    title={label}
                    className={`press inline-flex ctl-icon-sm items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white ${view === key ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'}`}
                  >
                    <Icon className="size-3.5" />
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
              <p className="text-[clamp(2.75rem,13vw,4rem)] leading-none font-semibold tracking-[-0.035em]">
                <span className="sr-only">{formatBRLRound(current.total)}</span>
                <span aria-hidden="true">
                  <AnimatedNumber value={Math.round(current.total / 100)} format={(v) => `R$ ${v.toLocaleString('pt-BR')}`} duration={0.8} />
                </span>
              </p>
              {delta !== null && (
                <p className="mb-1.5 flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-xs">
                  {delta > 0 ? (
                    <ArrowUpRight className="size-3.5" style={{ color: 'var(--warning)' }} />
                  ) : (
                    <ArrowDownRight className="size-3.5" style={{ color: 'var(--good)' }} />
                  )}
                  <span className="num font-semibold">{Math.abs(Math.round(delta * 100))}%</span>
                  <span className="text-white/75">
                    {delta > 0 ? 'acima' : 'abaixo'} de {previousLabel}
                    {current.isCurrent ? ` até o dia ${current.dayOfMonth}` : ''}
                  </span>
                </p>
              )}
            </div>

            <ul className="mt-4 flex gap-4 text-xs text-white/80">
              <li className="flex items-center gap-1.5">
                <span className="h-0.5 w-3.5 rounded-full bg-lime" /> <span className="first-letter:uppercase">{currentLabel}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-0.5 w-3.5 rounded-full bg-white/60" />{' '}
                <span className="first-letter:uppercase">{previousLabel}</span>
              </li>
            </ul>

            <Swap id={`${month}-${view}`} dir={dir}>
            {view === 'chart' ? (
              <div className="mt-2 h-48 w-full sm:h-64">
                <Suspense fallback={<div className="size-full animate-pulse rounded-xl bg-black/15" role="status" aria-label="Carregando gráfico" />}>
                  <SpendChart data={series} budget={budgetTotal} currentLabel={currentLabel} previousLabel={previousLabel} />
                </Suspense>
              </div>
            ) : (
              <div className="mt-3 h-48 overflow-y-auto rounded-lg bg-black/20 sm:h-64">
                <table className="w-full text-sm">
                  <caption className="sr-only">Gasto acumulado por dia</caption>
                  <thead className="sticky top-0 bg-brand-deeper text-left text-xs text-white/75">
                    <tr>
                      <th className="px-3 py-2 font-medium">Dia</th>
                      <th className="px-3 py-2 text-right font-medium first-letter:uppercase">{currentLabel}</th>
                      <th className="px-3 py-2 text-right font-medium first-letter:uppercase">{previousLabel}</th>
                    </tr>
                  </thead>
                  <tbody className="num">
                    {series.map((p) => (
                      <tr key={p.day} className="border-t border-white/10">
                        <td className="px-3 py-1.5">{p.day}</td>
                        <td className="px-3 py-1.5 text-right">{p.current === null ? '—' : formatBRL(p.current)}</td>
                        <td className="px-3 py-1.5 text-right text-white/75">
                          {p.previous === null ? '—' : formatBRL(p.previous)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </Swap>
          </div>
        </BentoCell>

        {/* 2 — orçamento */}
        <BentoCell index={1} label="Orçamento do mês" className="order-5 col-span-1 items-center justify-center p-4 text-center sm:p-5 lg:order-none lg:col-span-2">
          <p className="eyebrow self-start">orçamento</p>
          {budgetTotal > 0 ? (
            <>
              <div className="relative my-2">
                <AnimatedCircularProgressBar
                  value={Math.min(100, usedPct)}
                  gaugePrimaryColor={ringColor}
                  gaugeSecondaryColor="var(--border)"
                  className="size-28 text-[1.625rem] tracking-[-0.03em] [&>span]:after:ml-0.5 [&>span]:after:text-sm [&>span]:after:font-medium [&>span]:after:text-muted-foreground [&>span]:after:content-['%']"
                />
                <span className="sr-only">{usedPct}% do orçamento usado</span>
              </div>
              <Swap id={month} dir={dir}>
              <p className="text-xs text-muted-foreground">
                {usedPct > 100 ? (
                  <>
                    <span className="num font-medium text-foreground">{formatBRLRound(-left)}</span> acima do teto
                  </>
                ) : (
                  <>
                    <span className="num font-medium text-foreground">{formatBRLRound(left)}</span>{' '}
                    {current.isCurrent ? 'livres até o fim do mês' : 'sobraram no mês'}
                  </>
                )}
              </p>
              </Swap>
            </>
          ) : (
            <Link to="/orcamentos" className="hit mt-3 text-sm text-primary underline-offset-4 hover:underline">
              Definir limites
            </Link>
          )}
        </BentoCell>

        {/* 3 — assinaturas: o único bloco em cor de realce */}
        <BentoCell
          index={2}
          label="Assinaturas"
          className="order-5 col-span-1 border-transparent bg-lime p-4 text-lime-ink hover:border-transparent sm:p-5 lg:order-none lg:col-span-3"
        >
          <p className="eyebrow !text-lime-ink/75">assinaturas ativas · {subs.active.length}</p>
          <p className="mt-2 text-[clamp(1.5rem,7vw,2.125rem)] leading-none font-semibold tracking-[-0.03em]">
            {formatBRLRound(subs.monthly)}
            <span className="text-base font-medium tracking-normal opacity-75"> /mês</span>
          </p>
          <p className="mt-1.5 text-sm opacity-80">{formatBRLRound(subs.yearly)} por ano</p>
          {subs.upcoming[0] && (
            <p className="mt-3 mb-4 border-t border-lime-ink/20 pt-3 text-sm">
              <span className="font-medium">{subs.upcoming[0].note.title}</span> renova {relativeDay(subs.upcoming[0].next!, todayISO)}
            </p>
          )}
          <Link
            to="/assinaturas"
            className="press mt-auto inline-flex ctl-sm items-center gap-1.5 self-start rounded-lg bg-lime-ink px-3 text-sm font-medium text-lime outline-none focus-visible:ring-2 focus-visible:ring-lime-ink focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lime)]"
          >
            Abrir o cofre <ArrowRight className="size-3.5" />
          </Link>
        </BentoCell>

        {/* 4 — acerto entre moradores */}
        <BentoCell index={3} label="Acerto da casa" className="order-4 col-span-2 lg:order-none lg:col-span-5">
          <div className="flex items-center justify-between">
            <p className="eyebrow">acerto da casa</p>
            <Link to="/moradores" className="hit text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Ver detalhes
            </Link>
          </div>
          {transfers.length === 0 ? (
            <p className="mt-3 flex items-center gap-2 text-sm">
              <CircleCheck className="size-4" style={{ color: 'var(--good)' }} /> Tudo quitado entre os moradores.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2.5">
              {transfers.slice(0, 3).map((t) => (
                <li key={`${t.from_id}-${t.to_id}`} className="flex items-center gap-2 text-sm">
                  <MemberAvatar member={member(t.from_id)} size="sm" />
                  <span className="truncate">{member(t.from_id)?.name}</span>
                  <ArrowRight className="size-3.5 shrink-0 text-faint" aria-label="deve a" />
                  <MemberAvatar member={member(t.to_id)} size="sm" />
                  <span className="truncate">{member(t.to_id)?.name}</span>
                  <span className="num ml-auto font-semibold">{formatBRL(t.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </BentoCell>

        {/* 5 — para onde foi */}
        <BentoCell index={4} label="Gastos por categoria" className="order-6 col-span-2 lg:order-none lg:col-span-7">
          <p className="eyebrow mb-3">para onde foi o dinheiro</p>
          <Swap id={month} dir={dir}>
          {current.total > 0 ? (
            <>
              <CategoryBar values={current.byCategory} />
              <table className="mt-4 w-full text-sm">
                <caption className="sr-only">Gasto e orçamento por categoria</caption>
                <thead className="sr-only">
                  <tr>
                    <th>Categoria</th>
                    <th>Gasto</th>
                    <th>Limite</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIES.filter((c) => current.byCategory[c.id] > 0)
                    .sort((a, b) => current.byCategory[b.id] - current.byCategory[a.id])
                    .slice(0, 4)
                    .map((c) => {
                      const limit = data.budgets.find((b) => b.category_id === c.id)?.limit ?? 0
                      return (
                        <tr key={c.id} className="border-t border-border">
                          <td className="py-2">
                            <span className="flex items-center gap-2">
                              <span className="size-2 rounded-[2px]" style={{ background: c.color }} />
                              {c.name}
                            </span>
                          </td>
                          <td className="num py-2 text-right font-medium">{formatBRL(current.byCategory[c.id])}</td>
                          <td className="num hidden w-40 py-2 text-right text-muted-foreground sm:table-cell">
                            {limit > 0 ? `de ${formatBRLRound(limit)}` : 'sem limite'}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum gasto registrado neste mês.</p>
          )}
          </Swap>
        </BentoCell>

        {/* 6 — avisos */}
        <BentoCell index={5} label="Avisos" className="order-2 col-span-2 lg:order-none lg:col-span-5">
          <p className="eyebrow mb-3">o que merece atenção</p>
          <Swap id={month} dir={dir}>
          {insights.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CircleCheck className="size-4" style={{ color: 'var(--good)' }} />
              {current.isCurrent ? 'Nada fora do esperado por enquanto.' : 'Os avisos valem só para o mês em andamento.'}
            </p>
          ) : (
            <ul className="flex flex-col gap-3.5">
              {insights.slice(0, 4).map((insight) => {
                const tone = TONE[insight.tone]
                return (
                  <li key={insight.title} className="flex gap-3">
                    <tone.icon className="mt-0.5 size-4 shrink-0" style={{ color: tone.color }} aria-label={tone.label} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{insight.title}</p>
                      <p className="text-[0.8125rem] text-muted-foreground">{insight.detail}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          </Swap>
        </BentoCell>

        {/* 7 — últimos lançamentos */}
        <BentoCell index={6} tilt={false} label="Últimos lançamentos" className="order-7 col-span-2 md:col-span-4 lg:order-none lg:col-span-7">
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow">últimos lançamentos</p>
            <Link to="/gastos" className="hit text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Ver todos
            </Link>
          </div>
          <Swap id={month} dir={dir}>
          {recent.length === 0 ? (
            <div className="flex flex-col items-start gap-3 py-2">
              <p className="text-sm text-muted-foreground">Ainda não há gastos neste mês.</p>
              <Button size="sm" onClick={() => openNew()}>
                Registrar o primeiro
              </Button>
            </div>
          ) : (
            <AnimatedList
              key={month}
              items={recent.map((e) => ({ id: e.id, title: e.description }))}
              renderItem={(_item, index) => {
                const e = recent[index]
                if (!e) return null
                return (
                  <>
                    <ExpenseIcon expense={e} size="md" className="self-start" />
                    {/* o título usa a largura toda; o valor fica na linha de baixo, à direita */}
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="line-clamp-2 text-sm leading-snug font-semibold break-words">{e.description}</span>
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 text-xs leading-snug text-muted-foreground">
                          {formatDate(e.date)}
                          <span className="hidden sm:inline"> · {category(e.category_id).name}</span> · {member(e.payer_id)?.name ?? '—'} pagou
                        </span>
                        <span className="num shrink-0 text-sm leading-snug font-semibold">{formatBRL(e.amount)}</span>
                      </span>
                    </span>
                  </>
                )
              }}
              onItemSelect={() => navigate('/gastos')}
              frame={false}
              showGradients={false}
              enableArrowNavigation
              accentColor={theme.primary}
              width="100%"
              maxHeight={520}
              gap={6}
              radius={12}
              stagger={0.05}
              className="-mx-1.5"
            />
          )}
          </Swap>
        </BentoCell>

        {/* 8 — próximas cobranças */}
        <BentoCell index={7} label="Próximas cobranças" className="order-3 col-span-2 lg:order-none lg:col-span-5">
          <p className="eyebrow mb-3">próximas cobranças</p>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma assinatura ativa.</p>
          ) : (
            <ul className="flex flex-col">
              {upcoming.map((r) => (
                <li key={r.note.id} className="border-t border-border first:border-t-0">
                  <Link
                    to={`/assinaturas/${r.note.id}`}
                    className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-muted py-1 leading-tight">
                      <span className="num text-base font-semibold">{Number(r.next!.slice(8, 10))}</span>
                      <span className="text-xs text-muted-foreground uppercase">{formatDate(r.next!, 'MMM')}</span>
                    </span>
                    <SubscriptionIcon note={r.note} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.note.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {relativeDay(r.next!, todayISO)} · {member(r.sub.payer_id)?.name} paga
                      </span>
                    </span>
                    <span className="num text-sm font-medium">{formatBRL(r.sub.price)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </BentoCell>
      </div>
    </>
  )
}
