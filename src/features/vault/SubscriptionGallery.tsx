import { ArrowDown, ArrowUp, Check, GripVertical, ListChecks } from 'lucide-react'
import { motion, Reorder, useDragControls } from 'motion/react'
import { useId, useMemo, useState } from 'react'
import { AvatarStack } from '@/components/common/MemberAvatar'
import { Segmented } from '@/components/common/Segmented'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, relativeDay } from '@/domain/dates'
import { formatBRL, formatBRLRound } from '@/domain/money'
import { CYCLE_LABEL, CYCLE_SUFFIX } from '@/domain/subscriptions'
import type { VaultGroupBy, VaultSortBy } from '@/domain/types'
import { PayerSelect } from '@/features/members/PayerSelect'
import { cn } from '@/lib/utils'
import { useMember, useToday, type SubscriptionRow } from '@/store/selectors'
import { useAppStore, useData } from '@/store/useAppStore'
import { SubscriptionIcon } from './SubscriptionIcon'

interface Group {
  key: string
  name: string
  rows: SubscriptionRow[]
  monthly: number
  inactive: boolean
}

const SORTS: { value: VaultSortBy; label: string }[] = [
  { value: 'manual', label: 'Minha ordem' },
  { value: 'price', label: 'Maior preço' },
  { value: 'next', label: 'Próxima cobrança' },
  { value: 'name', label: 'Nome' },
]

function comparator(sortBy: VaultSortBy) {
  const byName = (a: SubscriptionRow, b: SubscriptionRow) => a.note.title.localeCompare(b.note.title, 'pt-BR')
  const byPrice = (a: SubscriptionRow, b: SubscriptionRow) => b.monthly - a.monthly || byName(a, b)
  if (sortBy === 'name') return byName
  if (sortBy === 'next') {
    return (a: SubscriptionRow, b: SubscriptionRow) => (a.next ?? '9999').localeCompare(b.next ?? '9999') || byName(a, b)
  }
  if (sortBy === 'manual') {
    // quem ainda não tem posição escolhida vai para o fim, por preço
    return (a: SubscriptionRow, b: SubscriptionRow) =>
      (a.sub.sort ?? Number.MAX_SAFE_INTEGER) - (b.sub.sort ?? Number.MAX_SAFE_INTEGER) || byPrice(a, b)
  }
  return byPrice
}

/** Galeria de assinaturas: um cartão por assinatura, agrupada e ordenada como o usuário preferir. */
export function SubscriptionGallery({ rows, onOpen }: { rows: SubscriptionRow[]; onOpen: (id: string) => void }) {
  const data = useData()
  const member = useMember()
  const setVaultPrefs = useAppStore((s) => s.setVaultPrefs)
  const setSubscriptionOrder = useAppStore((s) => s.setSubscriptionOrder)
  const [organizing, setOrganizing] = useState(false)

  const groupBy: VaultGroupBy = data.settings?.vault?.group_by ?? 'group'
  const sortBy: VaultSortBy = data.settings?.vault?.sort_by ?? 'price'

  const groups = useMemo(() => {
    const sort = comparator(sortBy)
    const buckets = new Map<string, Group>()
    const push = (key: string, name: string, row: SubscriptionRow, inactive = false) => {
      const g = buckets.get(key) ?? { key, name, rows: [], monthly: 0, inactive }
      g.rows.push(row)
      if (!inactive) g.monthly += row.monthly
      buckets.set(key, g)
    }
    for (const r of rows) {
      if (r.sub.status !== 'active') push('~paradas', 'Pausadas e canceladas', r, true)
      else if (groupBy === 'payer') push(`p:${r.sub.payer_id}`, `${member(r.sub.payer_id)?.name ?? 'Sem pagador'} paga`, r)
      else if (groupBy === 'none') push('todas', 'Ativas', r)
      else push(`g:${r.sub.group.trim().toLowerCase()}`, r.sub.group.trim() || 'Sem grupo', r)
    }
    const list = [...buckets.values()].map((g) => ({ ...g, rows: [...g.rows].sort(sort) }))
    const first = (g: Group) => Math.min(...g.rows.map((r) => r.sub.sort ?? Number.MAX_SAFE_INTEGER))
    return list.sort(
      (a, b) =>
        Number(a.inactive) - Number(b.inactive) ||
        (sortBy === 'manual' ? first(a) - first(b) : 0) ||
        b.monthly - a.monthly ||
        a.name.localeCompare(b.name, 'pt-BR'),
    )
  }, [rows, groupBy, sortBy, member])

  const flatIds = () => groups.flatMap((g) => g.rows.map((r) => r.note.id))

  const toggleOrganize = () => {
    if (!organizing && sortBy !== 'manual') {
      // a ordem que está na tela vira o ponto de partida da ordem manual
      setSubscriptionOrder(flatIds())
      setVaultPrefs({ sort_by: 'manual' })
    }
    setOrganizing((v) => !v)
  }

  /** Substitui a sequência de um grupo dentro da ordem geral. */
  const commitGroup = (groupKey: string, ids: string[]) => {
    setSubscriptionOrder(groups.flatMap((g) => (g.key === groupKey ? ids : g.rows.map((r) => r.note.id))))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Agrupar por</span>
        <Segmented
          label="Agrupar por"
          value={groupBy}
          onChange={(v) => setVaultPrefs({ group_by: v })}
          options={[
            { value: 'group', label: 'Grupo' },
            { value: 'payer', label: 'Pagador' },
            { value: 'none', label: 'Juntas' },
          ]}
          className="min-w-56 flex-1 sm:max-w-72"
        />
        <Select
          value={sortBy}
          onValueChange={(v) => {
            if (v === 'manual' && sortBy !== 'manual') setSubscriptionOrder(flatIds())
            setVaultPrefs({ sort_by: v as VaultSortBy })
          }}
          disabled={organizing}
        >
          <SelectTrigger className="ctl-sm w-44" aria-label="Ordenar por">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant={organizing ? 'default' : 'secondary'} className="press ml-auto ctl-sm gap-2" onClick={toggleOrganize} aria-pressed={organizing}>
          {organizing ? <Check className="size-4" /> : <ListChecks className="size-4" />}
          {organizing ? 'Concluir' : 'Organizar'}
        </Button>
      </div>
      {organizing && (
        <p className="-mt-3 text-sm text-muted-foreground">
          Arraste pela alça ou use as setas para mudar a ordem. Aqui também dá para trocar quem paga, corrigir o nome da pessoa e
          mover a assinatura de grupo.
        </p>
      )}

      {groups.map((group, gi) => (
        <section key={group.key} aria-label={group.name}>
          <header className="mb-3 flex items-baseline gap-3 border-b border-border pb-2">
            <h2 className="text-lg font-semibold tracking-[-0.015em]">{group.name}</h2>
            <span className="text-sm text-muted-foreground">
              {group.rows.length} {group.rows.length === 1 ? 'assinatura' : 'assinaturas'}
            </span>
            {!group.inactive && (
              <span className="num ml-auto text-sm">
                <span className="font-semibold">{formatBRLRound(group.monthly)}</span>
                <span className="text-muted-foreground"> /mês</span>
              </span>
            )}
          </header>

          {organizing ? (
            <OrganizeList group={group} onCommit={(ids) => commitGroup(group.key, ids)} />
          ) : (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {group.rows.map((r, i) => (
                <motion.li
                  key={r.note.id}
                  layout="position"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(0.3, gi * 0.05 + i * 0.03), duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <SubscriptionCard row={r} dimmed={group.inactive} onOpen={onOpen} />
                </motion.li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}

function SubscriptionCard({ row: r, dimmed, onOpen }: { row: SubscriptionRow; dimmed: boolean; onOpen: (id: string) => void }) {
  const member = useMember()
  const todayISO = useToday()
  const sharers = (r.sub.shared_with.length ? r.sub.shared_with : [r.sub.payer_id]).map((id) => member(id))
  return (
    <button
      type="button"
      onClick={() => onOpen(r.note.id)}
      className={cn(
        'press flex h-full w-full flex-col gap-4 rounded-2xl border border-border bg-card p-4 text-left outline-none transition-colors hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring sm:p-5',
        dimmed && 'opacity-70',
      )}
    >
      <span className="flex items-start gap-3.5">
        <SubscriptionIcon note={r.note} size="lg" />
        <span className="min-w-0 flex-1">
          <span className="block text-base leading-snug font-semibold tracking-[-0.01em] break-words">{r.note.title}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {CYCLE_LABEL[r.sub.cycle]}
            {r.sub.payment_method ? ` · ${r.sub.payment_method}` : ''}
          </span>
        </span>
        <span className="num shrink-0 text-right">
          <span className="block text-lg leading-snug font-semibold tracking-[-0.02em]">{formatBRL(r.sub.price)}</span>
          <span className="block text-xs text-muted-foreground">{CYCLE_SUFFIX[r.sub.cycle]}</span>
        </span>
      </span>

      <span className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-border pt-3 text-xs">
        <span className="text-muted-foreground">
          {r.next ? (
            <>
              Próxima em <span className="font-medium text-foreground">{formatDate(r.next)}</span> · {relativeDay(r.next, todayISO)}
            </>
          ) : r.sub.status === 'paused' ? (
            `Pausada${r.sub.end_date ? ` desde ${formatDate(r.sub.end_date, "d 'de' MMM")}` : ''}`
          ) : (
            `Cancelada${r.sub.end_date ? ` em ${formatDate(r.sub.end_date, "d 'de' MMM")}` : ''}`
          )}
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {member(r.sub.payer_id)?.name} paga
          <AvatarStack members={sharers} size="xs" />
        </span>
      </span>
    </button>
  )
}

/* ------------------------------------------------------------- organizar */

function OrganizeList({ group, onCommit }: { group: Group; onCommit: (ids: string[]) => void }) {
  const stored = group.rows.map((r) => r.note.id)
  // durante o arrasto a ordem é local; só vai para o armazenamento ao soltar
  const [draft, setDraft] = useState<string[] | null>(null)
  const order = draft ?? stored
  const byId = new Map(group.rows.map((r) => [r.note.id, r]))

  const move = (id: string, delta: number) => {
    const index = stored.indexOf(id)
    const target = index + delta
    if (index < 0 || target < 0 || target >= stored.length) return
    const next = [...stored]
    ;[next[index], next[target]] = [next[target], next[index]]
    onCommit(next)
  }

  return (
    <Reorder.Group axis="y" values={order} onReorder={setDraft} className="flex flex-col gap-2">
      {order.map((id, index) => {
        const row = byId.get(id)
        if (!row) return null
        return (
          <OrganizeRow
            key={id}
            row={row}
            first={index === 0}
            last={index === order.length - 1}
            onMove={(delta) => move(id, delta)}
            onDrop={() => {
              if (draft) onCommit(draft)
              setDraft(null)
            }}
          />
        )
      })}
    </Reorder.Group>
  )
}

function OrganizeRow({
  row: r,
  first,
  last,
  onMove,
  onDrop,
}: {
  row: SubscriptionRow
  first: boolean
  last: boolean
  onMove: (delta: number) => void
  onDrop: () => void
}) {
  const uid = useId()
  const controls = useDragControls()
  const updateNote = useAppStore((s) => s.updateNote)
  const groups = useData()
    .notes.filter((n) => n.kind === 'group')
    .map((n) => n.title)
  const [groupText, setGroupText] = useState(r.sub.group)
  const [lastGroup, setLastGroup] = useState(r.sub.group)
  if (lastGroup !== r.sub.group) {
    setLastGroup(r.sub.group)
    setGroupText(r.sub.group)
  }

  const commitGroup = () => {
    const clean = groupText.trim()
    if (clean !== r.sub.group) updateNote(r.note.id, { subscription: { ...r.sub, group: clean } })
  }

  return (
    <Reorder.Item
      value={r.note.id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card px-2.5 py-2.5"
      whileDrag={{ scale: 1.01, boxShadow: '0 12px 28px -12px rgb(0 0 0 / 0.5)' }}
    >
      <button
        type="button"
        aria-label={`Arrastar ${r.note.title}`}
        onPointerDown={(e) => controls.start(e)}
        className="flex ctl-icon-sm shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <SubscriptionIcon note={r.note} size="sm" />
      <span className="min-w-0 flex-1 basis-32">
        <span className="block truncate text-sm font-medium">{r.note.title}</span>
        <span className="num block text-xs text-muted-foreground">
          {formatBRL(r.sub.price)}
          {CYCLE_SUFFIX[r.sub.cycle]}
        </span>
      </span>

      <span className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Paga</span>
        <PayerSelect value={r.sub.payer_id} onChange={(payer_id) => updateNote(r.note.id, { subscription: { ...r.sub, payer_id } })} />
      </span>
      <span className="flex items-center gap-1.5">
        <label htmlFor={`${uid}-grupo`} className="text-xs text-muted-foreground">
          Grupo
        </label>
        <Input
          id={`${uid}-grupo`}
          list={`${uid}-grupos`}
          value={groupText}
          onChange={(e) => setGroupText(e.target.value)}
          onBlur={commitGroup}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          placeholder="Sem grupo"
          maxLength={60}
          className="ctl-sm w-36"
        />
        <datalist id={`${uid}-grupos`}>
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </span>

      <span className="ml-auto flex gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => onMove(-1)} disabled={first} aria-label={`Subir ${r.note.title}`}>
          <ArrowUp />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => onMove(1)} disabled={last} aria-label={`Descer ${r.note.title}`}>
          <ArrowDown />
        </Button>
      </span>
    </Reorder.Item>
  )
}
