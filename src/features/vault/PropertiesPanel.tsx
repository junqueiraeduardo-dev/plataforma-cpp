import { useId, useState } from 'react'
import { MemberAvatar } from '@/components/common/MemberAvatar'
import { Segmented } from '@/components/common/Segmented'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, relativeDay, today } from '@/domain/dates'
import { centsToInput, formatBRL, parseBRL } from '@/domain/money'
import { computeShares, equalSplit } from '@/domain/split'
import { CYCLE_LABEL, monthlyCost, nextCharge, yearlyCost } from '@/domain/subscriptions'
import type { BillingCycle, Member, SubscriptionProps, SubscriptionStatus } from '@/domain/types'
import { cn } from '@/lib/utils'
import { PayerSelect } from '@/features/members/PayerSelect'
import { IconPicker } from './IconPicker'
import { SubscriptionIcon } from './SubscriptionIcon'
import { subscriptionLook } from './subscriptionIcon'

const STATUS: { value: SubscriptionStatus; label: string }[] = [
  { value: 'active', label: 'Ativa' },
  { value: 'paused', label: 'Pausada' },
  { value: 'cancelled', label: 'Cancelada' },
]

/** Propriedades da assinatura, como o painel "Properties" do Obsidian. */
export function PropertiesPanel({
  title,
  sub,
  members,
  groups,
  payments,
  onChange,
}: {
  title: string
  sub: SubscriptionProps
  members: Member[]
  groups: string[]
  payments: string[]
  onChange: (next: SubscriptionProps) => void
}) {
  const uid = useId()
  const [picking, setPicking] = useState(false)
  const note = { title, subscription: sub }
  const look = subscriptionLook(note)
  const setStatus = (status: SubscriptionStatus) =>
    onChange({ ...sub, status, end_date: status === 'active' ? null : (sub.end_date ?? today()) })

  const toggleShared = (id: string) => {
    const has = sub.shared_with.includes(id)
    const next = has ? sub.shared_with.filter((x) => x !== id) : [...sub.shared_with, id]
    if (next.length > 0) onChange({ ...sub, shared_with: next })
  }

  const next = nextCharge(sub, today())
  const participants = sub.shared_with.length ? sub.shared_with : [sub.payer_id]
  const each = Math.max(...Object.values(computeShares(sub.price, equalSplit(participants))), 0)

  const row = 'grid grid-cols-1 gap-1.5 py-1.5 sm:grid-cols-[7.5rem_1fr] sm:items-center sm:gap-3'
  const label = 'text-[0.8125rem] text-muted-foreground'

  return (
    <section aria-label="Propriedades da assinatura" className="rounded-xl border border-border bg-muted/40 px-4 py-3">
      <div className={row}>
        <span className={label}>Ícone e cor</span>
        <div className="flex items-center gap-3">
          <SubscriptionIcon note={note} size="md" />
          <span className="min-w-0 text-[0.8125rem] text-muted-foreground">
            {look.autoIcon ? (look.icon.kind === 'brand' ? `Logotipo ${look.icon.label}` : 'Automático') : look.icon.label}
          </span>
          <Button type="button" variant="secondary" size="sm" onClick={() => setPicking(true)}>
            Trocar
          </Button>
        </div>
        <IconPicker open={picking} onOpenChange={setPicking} note={note} onChange={(patch) => onChange({ ...sub, ...patch })} />
      </div>

      <div className={row}>
        <span className={label} id={`${uid}-status`}>
          Situação
        </span>
        <Segmented label="Situação da assinatura" value={sub.status} onChange={setStatus} options={STATUS} className="max-w-xs" />
      </div>

      <div className={row}>
        <label className={label} htmlFor={`${uid}-price`}>
          Preço
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <PriceField key={sub.price} id={`${uid}-price`} cents={sub.price} onCommit={(price) => onChange({ ...sub, price })} />
          <Select value={sub.cycle} onValueChange={(v) => onChange({ ...sub, cycle: v as BillingCycle })}>
            <SelectTrigger className="ctl-sm w-32" aria-label="Ciclo de cobrança">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CYCLE_LABEL) as BillingCycle[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {CYCLE_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={row}>
        <label className={label} htmlFor={`${uid}-start`}>
          Primeira cobrança
        </label>
        <Input
          id={`${uid}-start`}
          type="date"
          value={sub.start_date}
          onChange={(e) => /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) && onChange({ ...sub, start_date: e.target.value })}
          className="ctl-sm w-40"
        />
      </div>

      <div className={row}>
        <span className={label}>Quem paga</span>
        <PayerSelect value={sub.payer_id} onChange={(payer_id) => onChange({ ...sub, payer_id })} />
      </div>

      <div className={row}>
        <span className={label}>Dividem</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Moradores que dividem">
          {members.map((m) => {
            const on = sub.shared_with.includes(m.id)
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleShared(m.id)}
                className={cn(
                  'press inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-[0.8125rem] outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  on ? 'border-foreground/25 bg-accent text-foreground' : 'border-border text-muted-foreground opacity-60 hover:opacity-100',
                )}
              >
                <MemberAvatar member={m} size="xs" />
                {m.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className={row}>
        <label className={label} htmlFor={`${uid}-group`}>
          Grupo
        </label>
        <Input
          id={`${uid}-group`}
          list={`${uid}-groups`}
          value={sub.group}
          onChange={(e) => onChange({ ...sub, group: e.target.value })}
          placeholder="Streaming, Software…"
          maxLength={60}
          className="ctl-sm max-w-56"
        />
        <datalist id={`${uid}-groups`}>
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </div>

      <div className={row}>
        <label className={label} htmlFor={`${uid}-pay`}>
          Pagamento
        </label>
        <Input
          id={`${uid}-pay`}
          list={`${uid}-payments`}
          value={sub.payment_method}
          onChange={(e) => onChange({ ...sub, payment_method: e.target.value })}
          placeholder="Cartão, débito automático…"
          maxLength={60}
          className="ctl-sm max-w-56"
        />
        <datalist id={`${uid}-payments`}>
          {payments.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Próxima cobrança</dt>
          <dd className="mt-0.5 font-medium">
            {next ? (
              <>
                {formatDate(next)} <span className="font-normal text-muted-foreground">· {relativeDay(next)}</span>
              </>
            ) : (
              <span className="text-muted-foreground">
                {sub.end_date ? `Parou em ${formatDate(sub.end_date, "d 'de' MMM 'de' yyyy")}` : 'Sem cobranças'}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Equivale por mês</dt>
          <dd className="num mt-0.5 font-medium">{formatBRL(monthlyCost(sub))}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Por ano</dt>
          <dd className="num mt-0.5 font-medium">{formatBRL(yearlyCost(sub))}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Cada um paga</dt>
          <dd className="num mt-0.5 font-medium">
            {formatBRL(each)}
            {participants.length > 1 && <span className="font-normal text-muted-foreground"> × {participants.length}</span>}
          </dd>
        </div>
      </dl>
    </section>
  )
}

/** Preço digitado livremente; só vale ao sair do campo ou apertar Enter. */
function PriceField({ id, cents, onCommit }: { id: string; cents: number; onCommit: (cents: number) => void }) {
  const [text, setText] = useState(centsToInput(cents))
  const [error, setError] = useState(false)
  const commit = () => {
    const value = parseBRL(text)
    if (value === null) return setError(true)
    setError(false)
    if (value !== cents) onCommit(value)
    else setText(centsToInput(value))
  }
  return (
    <>
      <div className="relative w-28">
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs text-muted-foreground">R$</span>
        <Input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          inputMode="decimal"
          aria-invalid={error}
          aria-describedby={error ? `${id}-erro` : undefined}
          className="num ctl-sm pl-8 text-right"
        />
      </div>
      {error && (
        <span id={`${id}-erro`} role="alert" className="order-last w-full text-xs text-critical">
          Use um valor como 44,90.
        </span>
      )}
    </>
  )
}
