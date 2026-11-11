import { ChevronDown, ChevronUp, CircleAlert, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { MemberAvatar } from '@/components/common/MemberAvatar'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { category } from '@/domain/categories'
import { readableOn } from '@/domain/color'
import { formatDate, shiftDay } from '@/domain/dates'
import { EXPENSE_RULES, matchRule } from '@/domain/expenseRules'
import { centsToInput, formatBRL, parseBRL } from '@/domain/money'
import { parseQuickAdd } from '@/domain/quickAdd'
import { equalSplit } from '@/domain/split'
import { cn } from '@/lib/utils'
import { useThemeColors, useToday } from '@/store/selectors'
import { useAppStore, useData } from '@/store/useAppStore'
import type { TransactionPrefill } from '@/store/useUi'
import { EXPENSE_ICONS } from './expenseIcons'

// os tipos que mais aparecem numa casa; o resto fica atrás de "Mais"
const FAVORITES = ['mercado', 'luz', 'agua', 'internet', 'gas', 'aluguel', 'restaurante', 'delivery', 'corrida', 'combustivel', 'farmacia']
const SHORT: Record<string, string> = { corrida: 'Corrida', lampada: 'Lâmpadas', imposto: 'Impostos', japones: 'Japonês', sorvete: 'Doces', ingresso: 'Ingressos', onibus: 'Ônibus', obra: 'Obra', moveis: 'Móveis', consulta: 'Consultas', cabelo: 'Beleza', curso: 'Cursos', frete: 'Frete', tv: 'TV', pix: 'Pix', estacionamento: 'Estacionar', eletronicos: 'Eletrônicos' }
const ruleByKey = new Map(EXPENSE_RULES.map((r) => [r.key, r]))
const ALL_KEYS = EXPENSE_ICONS.map((i) => i.key).filter((k) => k !== 'assinatura')
const iconByKey = new Map(EXPENSE_ICONS.map((i) => [i.key, i]))

/**
 * Registro de gasto em três toques: o valor, o tipo e "Registrar".
 * O campo de descrição é opcional e entende frases ("pizza ontem bruno");
 * quem quiser mudar a divisão passa para o formulário completo, já preenchido.
 */
export function QuickAddForm({ onExpand, onDone }: { onExpand: (prefill: TransactionPrefill) => void; onDone: () => void }) {
  const { members } = useData()
  const todayISO = useToday()
  const { categories } = useThemeColors()
  const addTransaction = useAppStore((s) => s.addTransaction)
  const deleteTransaction = useAppStore((s) => s.deleteTransaction)

  const [amountText, setAmountText] = useState('')
  const [amountTouched, setAmountTouched] = useState(false)
  const [text, setText] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [dateChoice, setDateChoice] = useState<string | null>(null)
  const [pickingDate, setPickingDate] = useState(false)
  const [payerChoice, setPayerChoice] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [tried, setTried] = useState(false)

  const parsed = useMemo(() => parseQuickAdd(text, { today: todayISO, members }), [text, todayISO, members])
  const yesterday = shiftDay(todayISO, -1)

  // o que foi escrito na descrição vale até a pessoa mexer no campo ou no botão correspondente
  const amount = amountTouched ? parseBRL(amountText) : parsed.amount
  const amountShown = amountTouched ? amountText : parsed.amount ? centsToInput(parsed.amount) : ''
  const autoKey = matchRule(parsed.description)?.key ?? null
  const activeKey = picked ?? autoKey
  const rule = activeKey ? ruleByKey.get(activeKey) : undefined
  const description = parsed.description || (picked ? (ruleByKey.get(picked)?.label ?? '') : '')
  const categoryId = rule?.category ?? parsed.category_id
  const date = dateChoice ?? parsed.date
  const payer = members.find((m) => m.id === (payerChoice ?? parsed.payer_id))

  const missing = amount === null || amount <= 0 ? 'Falta o valor, como 89,90.' : !description ? 'Toque em um tipo de gasto ou escreva o que foi.' : null
  // só vira alerta depois que a pessoa começou a preencher; antes disso é uma dica
  const started = tried || amountTouched || !!text.trim() || !!picked
  const ready = !missing && amount !== null && !!payer

  const keys = showAll ? ALL_KEYS : activeKey && !FAVORITES.includes(activeKey) ? [activeKey, ...FAVORITES.slice(0, -1)] : FAVORITES

  const prefill = (): TransactionPrefill => ({
    description,
    category_id: rule || parsed.found.category ? categoryId : undefined,
    amount: amount ?? undefined,
    date,
    payer_id: payer?.id,
    icon: picked,
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!ready || amount === null || !payer) return
    const saved = addTransaction({
      description,
      amount,
      date,
      category_id: categoryId,
      payer_id: payer.id,
      split: equalSplit(members.map((m) => m.id)),
      // tipo escolhido à mão fica gravado: o ícone não depende mais do texto
      icon: picked,
    })
    toast.success('Gasto registrado', {
      description: `${saved.description} — ${formatBRL(saved.amount)}`,
      action: { label: 'Desfazer', onClick: () => deleteTransaction(saved.id) },
    })
    onDone()
  }

  const chip = (on: boolean) =>
    cn(
      'press inline-flex ctl-sm items-center gap-2 rounded-full border px-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
      on ? 'border-primary bg-accent font-medium text-foreground' : 'border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground',
    )
  const otherDate = date !== todayISO && date !== yesterday

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>Novo gasto</DialogTitle>
        <DialogDescription>Digite o valor e toque no tipo. O resto já vem preenchido.</DialogDescription>
      </DialogHeader>

      {/* 1 — valor */}
      <div>
        <label htmlFor="gasto-valor" className="eyebrow mb-1.5 block">
          quanto foi
        </label>
        <div className="flex items-baseline gap-2 rounded-2xl border border-input bg-muted px-4 py-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40">
          <span className="text-xl font-medium text-muted-foreground" aria-hidden="true">
            R$
          </span>
          <input
            id="gasto-valor"
            autoFocus
            value={amountShown}
            onChange={(e) => {
              setAmountTouched(true)
              setAmountText(e.target.value.replace(/[^\d.,]/g, ''))
            }}
            placeholder="0,00"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            maxLength={12}
            aria-invalid={started && amountTouched && (amount === null || amount <= 0)}
            className="num w-full min-w-0 bg-transparent text-[2.25rem] leading-tight font-semibold tracking-[-0.03em] outline-none placeholder:text-faint"
          />
        </div>
      </div>

      {/* 2 — tipo */}
      <fieldset className="min-w-0">
        <legend className="eyebrow mb-2">o que foi</legend>
        <div className="grid grid-cols-3 gap-2 min-[400px]:grid-cols-4" role="radiogroup" aria-label="Tipo de gasto">
          {keys.map((key) => {
            const def = iconByKey.get(key)
            const r = ruleByKey.get(key)
            if (!def || !r) return null
            const on = activeKey === key
            const color = categories[r.category]
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setPicked(picked === key ? null : key)}
                className={cn(
                  'press flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border px-1.5 py-2 text-center text-xs leading-tight outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  on ? 'border-primary bg-accent font-medium text-foreground' : 'border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground',
                )}
              >
                <span
                  className="inline-flex size-8 items-center justify-center rounded-lg transition-colors duration-150"
                  style={on ? { background: color, color: readableOn(color) } : { background: 'var(--muted)' }}
                >
                  <def.Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="max-w-full [overflow-wrap:anywhere]">{SHORT[key] ?? def.label}</span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            className="press flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-1.5 py-2 text-xs leading-tight text-muted-foreground outline-none hover:border-foreground/25 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-muted">
              {showAll ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
            </span>
            {showAll ? 'Menos' : 'Mais tipos'}
          </button>
        </div>
      </fieldset>

      {/* 3 — descrição, opcional */}
      <div>
        <label htmlFor="rapido" className="eyebrow mb-1.5 block">
          descrição <span className="tracking-normal normal-case">(opcional)</span>
        </label>
        <Input
          id="rapido"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={rule ? `${rule.label} — ou escreva: pizza ontem` : 'Ex.: pizza ontem'}
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="done"
          maxLength={160}
        />
        {rule && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Entra como <span className="text-foreground">{description}</span>, em {category(categoryId).name}.
          </p>
        )}
      </div>

      {/* 4 — quando e quem */}
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="min-w-0">
          <legend className="eyebrow mb-2">quando</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Data do gasto">
            <button type="button" role="radio" aria-checked={date === todayISO} className={chip(date === todayISO)} onClick={() => { setDateChoice(todayISO); setPickingDate(false) }}>
              Hoje
            </button>
            <button type="button" role="radio" aria-checked={date === yesterday} className={chip(date === yesterday)} onClick={() => { setDateChoice(yesterday); setPickingDate(false) }}>
              Ontem
            </button>
            <button type="button" role="radio" aria-checked={otherDate} className={chip(otherDate)} onClick={() => setPickingDate((v) => !v)}>
              {otherDate ? formatDate(date, "d 'de' MMM") : 'Outro dia'}
            </button>
          </div>
          {pickingDate && (
            <Input
              type="date"
              value={date}
              max={todayISO}
              onChange={(e) => e.target.value && setDateChoice(e.target.value)}
              aria-label="Escolher a data"
              className="mt-2 w-full sm:w-44"
            />
          )}
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="eyebrow mb-2">quem pagou</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Quem pagou">
            {members.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={payer?.id === m.id} className={cn(chip(payer?.id === m.id), 'pl-1.5')} onClick={() => setPayerChoice(m.id)}>
                <MemberAvatar member={m} size="sm" /> <span className="max-w-28 truncate">{m.name}</span>
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {missing && started ? (
          <span role="alert" className="flex items-center gap-2 text-foreground">
            <CircleAlert className="size-4 shrink-0" style={{ color: 'var(--warning)' }} /> {missing}
          </span>
        ) : missing ? (
          'Comece pelo valor; depois toque no tipo de gasto.'
        ) : members.length > 1 ? (
          `Dividido por igual entre os ${members.length} moradores. Para outra divisão, use "Mais detalhes".`
        ) : (
          'Para mudar categoria ou divisão, use "Mais detalhes".'
        )}
      </p>

      <DialogFooter>
        <Button type="button" variant="secondary" className="gap-2" onClick={() => onExpand(prefill())}>
          <SlidersHorizontal className="size-4" /> Mais detalhes
        </Button>
        <Button type="submit" className="press" disabled={!ready}>
          Registrar gasto
        </Button>
      </DialogFooter>
    </form>
  )
}
