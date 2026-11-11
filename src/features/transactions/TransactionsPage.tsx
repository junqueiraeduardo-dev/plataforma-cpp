import { ChevronRight, Pencil, Plus, Repeat, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AnimatedNumber } from '@/components/common/AnimatedNumber'
import { EmptyState } from '@/components/common/EmptyState'
import { AvatarStack, MemberAvatar } from '@/components/common/MemberAvatar'
import { MonthSwitcher } from '@/components/common/MonthSwitcher'
import { PageHeader } from '@/components/common/PageHeader'
import { Swap } from '@/components/common/Swap'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CATEGORIES, category } from '@/domain/categories'
import { formatDate, monthKey } from '@/domain/dates'
import { formatBRL } from '@/domain/money'
import type { Expense } from '@/domain/types'
import { titleKey } from '@/domain/wikilinks'
import { useMember, useMonth, useToday } from '@/store/selectors'
import { useAppStore, useData } from '@/store/useAppStore'
import { useUi } from '@/store/useUi'
import { ExpenseIcon } from './ExpenseIcon'

export function TransactionsPage() {
  const data = useData()
  const todayISO = useToday()
  const member = useMember()
  const navigate = useNavigate()
  const openNew = useUi((s) => s.openNewTransaction)
  const openEdit = useUi((s) => s.openEditTransaction)
  const deleteTransaction = useAppStore((s) => s.deleteTransaction)
  const restoreTransaction = useAppStore((s) => s.restoreTransaction)

  const [month, setMonthRaw] = useState(() => monthKey(todayISO))
  const [dir, setDir] = useState(0)
  const setMonth = (next: string) => {
    setDir(next > month ? 1 : -1)
    setMonthRaw(next)
  }
  const [cat, setCat] = useState('todas')
  const [who, setWho] = useState('todos')
  const [query, setQuery] = useState('')
  const [sheet, setSheet] = useState(false)
  const current = useMonth(month)

  const rows = useMemo(() => {
    const q = titleKey(query)
    return current.expenses.filter(
      (e) =>
        (cat === 'todas' || e.category_id === cat) &&
        (who === 'todos' || e.payer_id === who || (e.shares[who] ?? 0) > 0) &&
        (!q || titleKey(e.description).includes(q)),
    )
  }, [current.expenses, cat, who, query])
  const sum = rows.reduce((s, e) => s + e.amount, 0)
  const active = Number(cat !== 'todas') + Number(who !== 'todos') + Number(query.trim() !== '')
  const clearFilters = () => {
    setCat('todas')
    setWho('todos')
    setQuery('')
  }

  const remove = (e: Expense) => {
    const original = data.transactions.find((t) => t.id === e.id)
    if (!original) return
    deleteTransaction(e.id)
    toast('Gasto excluído', {
      description: `${e.description} — ${formatBRL(e.amount)}`,
      action: { label: 'Desfazer', onClick: () => restoreTransaction(original) },
    })
  }
  const edit = (e: Expense) => {
    const original = data.transactions.find((t) => t.id === e.id)
    if (original) openEdit(original)
  }
  /** No celular a linha inteira é o alvo: gasto abre a edição, cobrança abre a assinatura. */
  const open = (e: Expense) => (e.source === 'subscription' ? navigate(`/assinaturas/${e.note_id}`) : edit(e))

  const categorySelect = (id?: string) => (
    <Select value={cat} onValueChange={setCat}>
      <SelectTrigger id={id} className="w-full md:w-48" aria-label="Categoria">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todas">Todas as categorias</SelectItem>
        {CATEGORIES.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span className="size-2 rounded-full" style={{ background: c.color }} />
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
  const memberSelect = (id?: string) => (
    <Select value={who} onValueChange={setWho}>
      <SelectTrigger id={id} className="w-full md:w-48" aria-label="Morador">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos os moradores</SelectItem>
        {data.members.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
  const searchInput = (id: string) => (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar descrição"
        aria-label="Buscar por descrição"
        enterKeyHint="search"
        className="pl-9"
      />
    </div>
  )

  return (
    <>
      <PageHeader
        title="Gastos"
        description="Tudo o que a casa pagou no mês, incluindo as cobranças de assinatura."
        actions={
          // no celular o botão flutuante cumpre este papel
          <Button size="lg" className="press hidden gap-2 md:inline-flex" onClick={() => openNew()} disabled={data.members.length === 0}>
            <Plus className="size-4" /> Novo gasto
          </Button>
        }
      />

      {/* uma linha de filtros, acima de tudo o que ela afeta; no celular ela acompanha a rolagem */}
      <div className="sticky top-0 z-20 -mx-5 mb-3 flex items-center gap-2 bg-background px-5 py-2 md:static md:mx-0 md:mb-4 md:flex-wrap md:bg-transparent md:p-0">
        <MonthSwitcher month={month} onChange={setMonth} />
        <Button variant="secondary" className="shrink-0 gap-2 md:hidden" onClick={() => setSheet(true)} aria-haspopup="dialog">
          <SlidersHorizontal className="size-4" /> Filtros
          {active > 0 && (
            <span className="num inline-flex size-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {active}
            </span>
          )}
        </Button>
        <div className="hidden items-center gap-2 md:flex">
          {categorySelect()}
          {memberSelect()}
          <div className="w-64">{searchInput('busca-gastos')}</div>
        </div>
      </div>
      <p className="mb-3 text-sm text-muted-foreground md:mb-4" aria-live="polite">
        {rows.length} {rows.length === 1 ? 'lançamento' : 'lançamentos'} ·{' '}
        <AnimatedNumber value={sum} format={formatBRL} duration={0.5} className="num font-medium text-foreground" />
        {active > 0 && (
          <button type="button" onClick={clearFilters} className="hit ml-2 underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            limpar filtros
          </button>
        )}
      </p>

      <Dialog open={sheet} onOpenChange={setSheet}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filtrar gastos</DialogTitle>
            <DialogDescription>Os filtros valem para a lista e para o total do mês.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filtro-cat">Categoria</Label>
              {categorySelect('filtro-cat')}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filtro-quem">Morador</Label>
              {memberSelect('filtro-quem')}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filtro-busca">Descrição</Label>
              {searchInput('filtro-busca')}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={clearFilters} disabled={active === 0}>
              Limpar filtros
            </Button>
            <Button onClick={() => setSheet(false)}>
              Ver {rows.length} {rows.length === 1 ? 'lançamento' : 'lançamentos'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Swap id={month} dir={dir}>
      {rows.length === 0 ? (
        <EmptyState
          title={active > 0 ? 'Nenhum gasto com esses filtros' : 'Nenhum gasto neste mês'}
          action={
            active > 0 ? (
              <Button variant="secondary" onClick={clearFilters}>
                Limpar filtros
              </Button>
            ) : (
              <Button onClick={() => openNew()} disabled={data.members.length === 0}>
                Registrar gasto
              </Button>
            )
          }
        >
          {active > 0
            ? 'Tente outra categoria, outro morador ou um termo de busca diferente.'
            : 'Registre o primeiro gasto para começar a acompanhar o mês.'}
        </EmptyState>
      ) : (
        <>
          {/* celular e tablet estreito: uma linha por gasto, toda ela tocável */}
          <ul className="overflow-hidden rounded-2xl border border-border bg-card md:hidden">
            {rows.map((e) => (
              <li key={e.id} className="border-t border-border first:border-t-0">
                <button
                  type="button"
                  onClick={() => open(e)}
                  aria-label={`${e.source === 'subscription' ? 'Abrir a assinatura' : 'Editar'} ${e.description}, ${formatBRL(e.amount)}`}
                  className="press flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <ExpenseIcon expense={e} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words leading-snug font-medium">{e.description}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                      {formatDate(e.date)} · {member(e.payer_id)?.name ?? '—'} pagou
                      <span className="hidden sm:inline"> · {category(e.category_id).name}</span>
                    </span>
                  </span>
                  <span className="num shrink-0 text-right font-semibold">{formatBRL(e.amount)}</span>
                  <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          {/* a partir do tablet: tabela */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Gastos do mês</caption>
              <thead className="border-b border-border text-left text-xs text-muted-foreground">
                <tr>
                  <th className="w-24 px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Categoria</th>
                  <th className="px-4 py-3 font-medium">Pagou</th>
                  <th className="hidden px-4 py-3 font-medium xl:table-cell">Dividido entre</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                  <th className="w-24 px-4 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const c = category(e.category_id)
                  const participants = Object.entries(e.shares)
                    .filter(([, v]) => v > 0)
                    .map(([id]) => member(id))
                  const isSub = e.source === 'subscription'
                  return (
                    <tr key={e.id} className="border-t border-border first:border-t-0 hover:bg-foreground/[0.03]">
                      <td className="num px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(e.date)}</td>
                      <td className="w-full min-w-56 px-4 py-3 font-medium">
                        <span className="flex items-center gap-2.5">
                          <ExpenseIcon expense={e} />
                          <span className="min-w-0 break-words">{e.description}</span>
                          {isSub && (
                            <Link
                              to={`/assinaturas/${e.note_id}`}
                              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Repeat className="size-3" /> assinatura
                            </Link>
                          )}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <span className="flex items-center gap-2 whitespace-nowrap text-muted-foreground">
                          <span className="size-2 rounded-[2px]" style={{ background: c.color }} />
                          {c.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <MemberAvatar member={member(e.payer_id)} size="sm" />
                          {member(e.payer_id)?.name ?? '—'}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 xl:table-cell">
                        <AvatarStack members={participants} />
                      </td>
                      <td className="num px-4 py-3 text-right font-semibold whitespace-nowrap">{formatBRL(e.amount)}</td>
                      <td className="px-4 py-2">
                        {!isSub && (
                          <span className="flex justify-end gap-1 text-muted-foreground">
                            <Button variant="ghost" size="icon-sm" onClick={() => edit(e)} aria-label={`Editar ${e.description}`}>
                              <Pencil />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => remove(e)} aria-label={`Excluir ${e.description}`}>
                              <Trash2 />
                            </Button>
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      </Swap>
    </>
  )
}
