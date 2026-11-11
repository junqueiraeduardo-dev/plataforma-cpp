import { Trash2 } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { MemberAvatar } from '@/components/common/MemberAvatar'
import { Segmented } from '@/components/common/Segmented'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CATEGORIES } from '@/domain/categories'
import { today } from '@/domain/dates'
import { centsToInput, formatBRL, parseBRL } from '@/domain/money'
import { computeShares, splitError } from '@/domain/split'
import type { CategoryId, Member, Split, SplitMode, Transaction } from '@/domain/types'
import { cn } from '@/lib/utils'
import { useAppStore, useData } from '@/store/useAppStore'
import { useUi, type TransactionPrefill } from '@/store/useUi'
import { ExpenseIcon } from './ExpenseIcon'
import { autoExpenseIcon, EXPENSE_ICONS } from './expenseIcons'
import { QuickAddForm } from './QuickAddForm'

export function TransactionDialog() {
  const state = useUi((s) => s.transactionDialog)
  const close = useUi((s) => s.closeTransactionDialog)
  return (
    <Dialog open={!!state} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[34rem]">
        {state && <Body key={state.editing?.id ?? 'novo'} editing={state.editing} prefill={state.prefill} onDone={close} />}
      </DialogContent>
    </Dialog>
  )
}

/** Gasto novo começa pelo lançamento rápido; edição e atalhos com dados prontos vão direto ao formulário. */
function Body({ editing, prefill, onDone }: { editing: Transaction | null; prefill?: TransactionPrefill; onDone: () => void }) {
  const [seed, setSeed] = useState<TransactionPrefill | undefined>(prefill)
  const [mode, setMode] = useState<'quick' | 'full'>(editing || prefill ? 'full' : 'quick')
  if (mode === 'quick') {
    return (
      <QuickAddForm
        onExpand={(next) => {
          setSeed(next)
          setMode('full')
        }}
        onDone={onDone}
      />
    )
  }
  return <TransactionForm editing={editing} prefill={seed} onDone={onDone} />
}

const MODES: { value: SplitMode; label: string }[] = [
  { value: 'equal', label: 'Igual' },
  { value: 'percent', label: 'Percentual' },
  { value: 'exact', label: 'Valores' },
]

function TransactionForm({
  editing,
  prefill,
  onDone,
}: {
  editing: Transaction | null
  prefill?: TransactionPrefill
  onDone: () => void
}) {
  const { members } = useData()
  const addTransaction = useAppStore((s) => s.addTransaction)
  const updateTransaction = useAppStore((s) => s.updateTransaction)
  const deleteTransaction = useAppStore((s) => s.deleteTransaction)
  const restoreTransaction = useAppStore((s) => s.restoreTransaction)

  const [description, setDescription] = useState(editing?.description ?? prefill?.description ?? '')
  const [amountText, setAmountText] = useState(editing ? centsToInput(editing.amount) : prefill?.amount ? centsToInput(prefill.amount) : '')
  const [date, setDate] = useState(editing?.date ?? prefill?.date ?? today())
  const [category, setCategory] = useState<CategoryId>(editing?.category_id ?? prefill?.category_id ?? 'mercado')
  const [icon, setIcon] = useState<string | null>(editing?.icon ?? prefill?.icon ?? null)
  const [payer, setPayer] = useState(editing?.payer_id ?? prefill?.payer_id ?? members[0]?.id ?? '')
  const [mode, setMode] = useState<SplitMode>(editing?.split.mode ?? 'equal')
  const [participants, setParticipants] = useState<Set<string>>(
    () => new Set(editing?.split.mode === 'equal' ? Object.keys(editing.split.shares) : members.map((m) => m.id)),
  )
  const [percents, setPercents] = useState<Record<string, string>>(() =>
    editing?.split.mode === 'percent'
      ? Object.fromEntries(Object.entries(editing.split.shares).map(([id, v]) => [id, String(v).replace('.', ',')]))
      : {},
  )
  const [exacts, setExacts] = useState<Record<string, string>>(() =>
    editing?.split.mode === 'exact'
      ? Object.fromEntries(Object.entries(editing.split.shares).map(([id, v]) => [id, centsToInput(v)]))
      : {},
  )
  const [submitted, setSubmitted] = useState(false)

  const amount = parseBRL(amountText)

  const split: Split = useMemo(() => {
    if (mode === 'equal') {
      return { mode, shares: Object.fromEntries([...participants].map((id) => [id, 1])) }
    }
    if (mode === 'percent') {
      const shares: Record<string, number> = {}
      for (const m of members) {
        const v = Number((percents[m.id] ?? '').replace(',', '.'))
        if (percents[m.id]?.trim() && Number.isFinite(v) && v > 0) shares[m.id] = v
      }
      return { mode, shares }
    }
    const shares: Record<string, number> = {}
    for (const m of members) {
      const v = parseBRL(exacts[m.id] ?? '')
      if (v && v > 0) shares[m.id] = v
    }
    return { mode, shares }
  }, [mode, participants, percents, exacts, members])

  const errors = {
    description: description.trim() ? null : 'Diga o que foi comprado ou pago.',
    amount: amount === null ? 'Informe um valor, como 129,90.' : amount <= 0 ? 'O valor precisa ser maior que zero.' : null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? null : 'Escolha a data do gasto.',
    payer: members.some((m) => m.id === payer) ? null : 'Escolha quem pagou.',
    split: amount && amount > 0 ? splitError(amount, split) : null,
  }
  const hasErrors = Object.values(errors).some(Boolean)
  const preview = amount && amount > 0 && !errors.split ? computeShares(amount, split) : null

  const changeMode = (next: SplitMode) => {
    // ao trocar de modo, parte da divisão atual em vez de começar do zero
    if (next === 'percent' && Object.keys(percents).length === 0) {
      const ids = mode === 'equal' ? [...participants] : members.map((m) => m.id)
      const each = ids.length ? Math.floor(1000 / ids.length) / 10 : 0
      const filled = Object.fromEntries(ids.map((id) => [id, String(each).replace('.', ',')]))
      if (ids.length) {
        const rest = Math.round((100 - each * (ids.length - 1)) * 10) / 10
        filled[ids[ids.length - 1]] = String(rest).replace('.', ',')
      }
      setPercents(filled)
    }
    if (next === 'exact' && Object.keys(exacts).length === 0 && amount && amount > 0) {
      const ids = mode === 'equal' ? [...participants] : members.map((m) => m.id)
      const shares = computeShares(amount, { mode: 'equal', shares: Object.fromEntries(ids.map((id) => [id, 1])) })
      setExacts(Object.fromEntries(Object.entries(shares).map(([id, v]) => [id, centsToInput(v)])))
    }
    setMode(next)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (hasErrors || amount === null) return
    const input = {
      description: description.trim(),
      amount,
      date,
      category_id: category,
      payer_id: payer,
      split,
      icon,
    }
    if (editing) {
      updateTransaction(editing.id, input)
      toast.success('Gasto atualizado', { description: `${input.description} — ${formatBRL(amount)}` })
    } else {
      addTransaction(input)
      toast.success('Gasto registrado', { description: `${input.description} — ${formatBRL(amount)}` })
    }
    onDone()
  }

  const removeIt = () => {
    if (!editing) return
    deleteTransaction(editing.id)
    toast('Gasto excluído', {
      description: `${editing.description} — ${formatBRL(editing.amount)}`,
      action: { label: 'Desfazer', onClick: () => restoreTransaction(editing) },
    })
    onDone()
  }

  const show = (key: keyof typeof errors) => (submitted ? errors[key] : null)

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{editing ? 'Editar gasto' : 'Novo gasto'}</DialogTitle>
        <DialogDescription>Quem pagou, quanto foi e como a casa divide.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-[1fr_9.5rem]">
        <Field label="Descrição" htmlFor="tx-desc" error={show('description')}>
          <Input
            id="tx-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mercado do mês"
            maxLength={120}
            autoFocus
            enterKeyHint="next"
            aria-invalid={!!show('description')}
          />
        </Field>
        <Field label="Valor (R$)" htmlFor="tx-amount" error={show('amount')}>
          <Input
            id="tx-amount"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
            className="num"
            aria-invalid={!!show('amount')}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Data" htmlFor="tx-date" error={show('date')}>
          <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!show('date')} />
        </Field>
        <Field label="Categoria" htmlFor="tx-cat">
          <Select value={category} onValueChange={(v) => setCategory(v as CategoryId)}>
            <SelectTrigger id="tx-cat" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.filter((c) => c.id !== 'assinaturas').map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="size-2 rounded-full" style={{ background: c.color }} />
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Quem pagou" htmlFor="tx-payer" error={show('payer')}>
          <Select value={payer} onValueChange={setPayer}>
            <SelectTrigger id="tx-payer" className="w-full">
              <SelectValue placeholder="Escolha" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-medium">Ícone</legend>
        <div className="flex items-center gap-3">
          <ExpenseIcon expense={{ description, category_id: category, icon }} size="md" />
          {/* uma fileira só, que rola de lado: os ícones não empurram o formulário para baixo */}
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1.5 [scrollbar-width:thin]" role="radiogroup" aria-label="Ícone do gasto">
            <button
              type="button"
              role="radio"
              aria-checked={icon === null}
              onClick={() => setIcon(null)}
              className={cn(
                'press ctl-sm shrink-0 rounded-lg border px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring',
                icon === null ? 'border-primary bg-accent' : 'border-input text-muted-foreground',
              )}
            >
              Automático: {autoExpenseIcon(description, category).label}
            </button>
            {EXPENSE_ICONS.map((def) => (
              <button
                key={def.key}
                type="button"
                role="radio"
                aria-checked={icon === def.key}
                aria-label={def.label}
                title={def.label}
                onClick={() => setIcon(def.key)}
                className={cn(
                  'press inline-flex ctl-icon-sm shrink-0 items-center justify-center rounded-lg border outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  icon === def.key ? 'border-primary bg-accent text-foreground' : 'border-transparent text-muted-foreground hover:bg-foreground/5',
                )}
              >
                <def.Icon className="size-4" />
              </button>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Divisão</legend>
        <Segmented label="Modo de divisão" value={mode} onChange={changeMode} options={MODES} />

        <ul className="flex flex-col gap-1.5">
          {members.map((m) => (
            <SplitRow
              key={m.id}
              member={m}
              mode={mode}
              checked={participants.has(m.id)}
              onToggle={() =>
                setParticipants((prev) => {
                  const next = new Set(prev)
                  if (next.has(m.id)) next.delete(m.id)
                  else next.add(m.id)
                  return next
                })
              }
              text={mode === 'percent' ? (percents[m.id] ?? '') : (exacts[m.id] ?? '')}
              onText={(v) =>
                mode === 'percent' ? setPercents((p) => ({ ...p, [m.id]: v })) : setExacts((p) => ({ ...p, [m.id]: v }))
              }
              share={preview?.[m.id]}
            />
          ))}
        </ul>
        <p
          role={errors.split ? 'alert' : undefined}
          className={cn('min-h-5 text-sm', errors.split ? 'text-critical' : 'text-muted-foreground')}
        >
          {errors.split ??
            (mode === 'equal'
              ? 'Centavos que sobram do arredondamento são distribuídos automaticamente.'
              : mode === 'percent'
                ? 'Os percentuais precisam somar 100%.'
                : 'Os valores precisam somar o total do gasto.')}
        </p>
      </fieldset>

      <DialogFooter>
        {editing && (
          <Button type="button" variant="ghost" className="gap-2 text-critical hover:text-critical sm:mr-auto" onClick={removeIt}>
            <Trash2 className="size-4" /> Excluir gasto
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" className="press">
          {editing ? 'Salvar alterações' : 'Registrar gasto'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function SplitRow({
  member,
  mode,
  checked,
  onToggle,
  text,
  onText,
  share,
}: {
  member: Member
  mode: SplitMode
  checked: boolean
  onToggle: () => void
  text: string
  onText: (v: string) => void
  share: number | undefined
}) {
  const id = `split-${member.id}`
  const included = mode === 'equal' ? checked : share !== undefined && share > 0
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
      {mode === 'equal' ? (
        <label htmlFor={id} className="flex flex-1 cursor-pointer items-center gap-3">
          <input id={id} type="checkbox" checked={checked} onChange={onToggle} className="size-4 accent-[var(--lime)]" />
          <MemberAvatar member={member} size="sm" />
          <span className={cn('text-sm', !checked && 'text-muted-foreground')}>{member.name}</span>
        </label>
      ) : (
        <>
          <label htmlFor={id} className="flex flex-1 items-center gap-3">
            <MemberAvatar member={member} size="sm" />
            <span className="text-sm">{member.name}</span>
          </label>
          <div className="relative w-28">
            <Input
              id={id}
              value={text}
              onChange={(e) => onText(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className={cn('num ctl-sm text-right', mode === 'percent' ? 'pr-7' : 'pl-8')}
              aria-label={`${mode === 'percent' ? 'Percentual' : 'Valor'} de ${member.name}`}
            />
            <span className="pointer-events-none absolute inset-y-0 flex items-center text-xs text-muted-foreground" style={mode === 'percent' ? { right: 10 } : { left: 10 }}>
              {mode === 'percent' ? '%' : 'R$'}
            </span>
          </div>
        </>
      )}
      <span className={cn('num w-24 text-right text-sm', included ? 'text-foreground' : 'text-faint')}>
        {share !== undefined && included ? formatBRL(share) : '—'}
      </span>
    </li>
  )
}

export function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor: string
  error?: string | null
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && (
        <p role="alert" className="text-xs text-critical">
          {error}
        </p>
      )}
    </div>
  )
}
