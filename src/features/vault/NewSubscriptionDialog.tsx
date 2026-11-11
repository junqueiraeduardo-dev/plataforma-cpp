import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { MemberAvatar } from '@/components/common/MemberAvatar'
import { Segmented } from '@/components/common/Segmented'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { today } from '@/domain/dates'
import { formatBRL, parseBRL } from '@/domain/money'
import { CYCLE_LABEL, CYCLE_SUFFIX } from '@/domain/subscriptions'
import type { BillingCycle, Note, SubscriptionProps } from '@/domain/types'
import { titleKey } from '@/domain/wikilinks'
import { cn } from '@/lib/utils'
import { useAppStore, useData } from '@/store/useAppStore'
import { BRANDS } from './brands'
import { IconTile, SubscriptionIcon } from './SubscriptionIcon'

const SUGGESTED = ['netflix', 'spotify', 'primevideo', 'youtube', 'hbomax', 'icloud', 'xbox', 'openai']
const CYCLES = (Object.keys(CYCLE_LABEL) as BillingCycle[]).map((value) => ({ value, label: CYCLE_LABEL[value] }))

/**
 * Criação de assinatura em um passo: nada é gravado até tocar em "Criar assinatura".
 * O logotipo aparece sozinho quando o nome é de um serviço conhecido.
 */
export function NewSubscriptionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (note: Note) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[32rem]">{open && <Form onCancel={() => onOpenChange(false)} onCreated={onCreated} />}</DialogContent>
    </Dialog>
  )
}

function Form({ onCancel, onCreated }: { onCancel: () => void; onCreated: (note: Note) => void }) {
  const { members, notes } = useData()
  const createNote = useAppStore((s) => s.createNote)

  const [name, setName] = useState('')
  const [priceText, setPriceText] = useState('')
  const [cycle, setCycle] = useState<BillingCycle>('monthly')
  const [start, setStart] = useState(today())
  const [payer, setPayer] = useState(members[0]?.id ?? '')
  const [shared, setShared] = useState<Set<string>>(() => new Set(members[0] ? [members[0].id] : []))
  const [submitted, setSubmitted] = useState(false)

  const price = parseBRL(priceText)
  const clean = name.trim()
  const q = titleKey(clean)
  const suggestions = useMemo(() => {
    if (!q) return SUGGESTED.map((slug) => BRANDS.find((b) => b.slug === slug)).filter((b) => !!b)
    return BRANDS.filter((b) => titleKey(b.title) !== q && (titleKey(b.title).includes(q) || b.aliases.some((a) => a.includes(q)))).slice(0, 6)
  }, [q])

  const errors = {
    name: !clean
      ? 'Dê um nome à assinatura, como Netflix.'
      : notes.some((n) => titleKey(n.title) === q)
        ? `Já existe uma nota chamada "${clean}". Use outro nome, como "${clean} família".`
        : null,
    price: price === null ? 'Informe o preço, como 39,90.' : price <= 0 ? 'O preço precisa ser maior que zero.' : null,
    start: /^\d{4}-\d{2}-\d{2}$/.test(start) ? null : 'Escolha a data da primeira cobrança.',
  }
  const show = (key: keyof typeof errors) => (submitted ? errors[key] : null)

  const choosePayer = (id: string) => {
    setPayer(id)
    // quem paga sempre participa da divisão
    setShared((prev) => new Set(prev).add(id))
  }
  const toggleShared = (id: string) => {
    if (id === payer) return
    setShared((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const draft: SubscriptionProps = {
    price: price ?? 0,
    cycle,
    start_date: start,
    end_date: null,
    status: 'active',
    payer_id: payer,
    shared_with: members.filter((m) => shared.has(m.id)).map((m) => m.id),
    group: '',
    payment_method: '',
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (Object.values(errors).some(Boolean) || price === null || !payer) return
    const created = createNote(clean, 'subscription', draft)
    toast.success(`${created.title} criada`, { description: `${formatBRL(price)}${CYCLE_SUFFIX[cycle]} · aparece nos cartões e no grafo.` })
    onCreated(created)
  }

  const chip = (on: boolean) =>
    cn(
      'press inline-flex ctl-sm items-center gap-2 rounded-full border pr-3.5 pl-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
      on ? 'border-primary bg-accent font-medium text-foreground' : 'border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground',
    )

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>Nova assinatura</DialogTitle>
        <DialogDescription>Preencha o básico e confirme. Grupo, forma de pagamento e anotações ficam para depois, na nota.</DialogDescription>
      </DialogHeader>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="nova-assinatura-nome">Serviço</Label>
        <div className="flex items-center gap-3">
          <SubscriptionIcon note={{ title: clean || '?', subscription: draft }} size="md" />
          <Input
            id="nova-assinatura-nome"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Netflix, academia, seguro…"
            maxLength={80}
            autoComplete="off"
            enterKeyHint="next"
            aria-invalid={!!show('name')}
            className="min-w-0 flex-1"
          />
        </div>
        {show('name') && (
          <p role="alert" className="text-xs text-critical">
            {show('name')}
          </p>
        )}
        {suggestions.length > 0 && (
          <div className="-mx-1 mt-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" aria-label="Serviços sugeridos">
            {suggestions.map((b) => (
              <button
                key={b.slug}
                type="button"
                onClick={() => setName(b.title)}
                className="press inline-flex ctl-sm shrink-0 items-center gap-2 rounded-full border border-border pr-3 pl-1.5 text-sm text-muted-foreground outline-none hover:border-foreground/25 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <IconTile icon={{ kind: 'brand', path: b.path, label: b.title }} color={b.hex} size="xs" className="rounded-full" />
                {b.title}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-[9.5rem_1fr]">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="nova-assinatura-preco">Preço (R$)</Label>
          <Input
            id="nova-assinatura-preco"
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
            autoComplete="off"
            className="num"
            aria-invalid={!!show('price')}
          />
          {show('price') && (
            <p role="alert" className="text-xs text-critical">
              {show('price')}
            </p>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium">Cobrança</span>
          <Segmented label="Ciclo de cobrança" value={cycle} onChange={setCycle} options={CYCLES} />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="nova-assinatura-data">Primeira cobrança</Label>
        <Input id="nova-assinatura-data" type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-invalid={!!show('start')} className="sm:w-48" />
        <p className="text-xs text-muted-foreground">As próximas seguem o mesmo dia, conforme o ciclo.</p>
        {show('start') && (
          <p role="alert" className="text-xs text-critical">
            {show('start')}
          </p>
        )}
      </div>

      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-medium">Quem paga</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Quem paga">
          {members.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={payer === m.id} className={chip(payer === m.id)} onClick={() => choosePayer(m.id)}>
              <MemberAvatar member={m} size="sm" /> <span className="max-w-28 truncate">{m.name}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {members.length > 1 && (
        <fieldset className="min-w-0">
          <legend className="mb-2 text-sm font-medium">Quem divide a conta</legend>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Quem divide a conta">
            {members.map((m) => {
              const on = shared.has(m.id)
              return (
                <button key={m.id} type="button" aria-pressed={on} disabled={m.id === payer} className={cn(chip(on), 'disabled:opacity-100')} onClick={() => toggleShared(m.id)}>
                  <MemberAvatar member={m} size="sm" /> <span className="max-w-28 truncate">{m.name}</span>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {shared.size <= 1 ? 'Só quem paga usa. Toque em outros moradores para dividir.' : `Dividida por igual entre ${shared.size} moradores.`}
          </p>
        </fieldset>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="press">
          Criar assinatura
        </Button>
      </DialogFooter>
    </form>
  )
}
