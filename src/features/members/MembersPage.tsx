import { ArrowRight, Camera, Check, CircleCheck, ImageOff, Pencil, Trash2, Undo2, UserPlus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/common/EmptyState'
import { ColorField } from '@/components/common/ColorField'
import { MemberAvatar } from '@/components/common/MemberAvatar'
import { PageHeader } from '@/components/common/PageHeader'
import SpotlightCard from '@/components/reactbits/SpotlightCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/domain/dates'
import { formatBRL } from '@/domain/money'
import type { Member } from '@/domain/types'
import { titleKey } from '@/domain/wikilinks'
import { useBalances, useMember, useThemeColors } from '@/store/selectors'
import { useAppStore, useData } from '@/store/useAppStore'
import { fileToIcon } from '@/features/vault/subscriptionIcon'

export function MembersPage() {
  const data = useData()
  const member = useMember()
  const { balances, transfers, paid, owed } = useBalances()
  const addMember = useAppStore((s) => s.addMember)
  const addSettlement = useAppStore((s) => s.addSettlement)
  const deleteSettlement = useAppStore((s) => s.deleteSettlement)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return setError('Digite o nome do morador.')
    if (data.members.some((m) => titleKey(m.name) === titleKey(clean))) return setError('Já existe um morador com esse nome.')
    addMember(clean)
    setName('')
    setError(null)
    toast.success(`${clean} agora mora na casa`)
  }

  const settle = (from_id: string, to_id: string, amount: number) => {
    const s = addSettlement({ from_id, to_id, amount })
    toast.success('Acerto registrado', {
      description: `${member(from_id)?.name} pagou ${formatBRL(amount)} a ${member(to_id)?.name}`,
      action: { label: 'Desfazer', onClick: () => deleteSettlement(s.id) },
    })
  }

  const history = [...data.settlements].sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <>
      <PageHeader
        title="Moradores"
        description="Quanto cada um pagou, quanto era a parte de cada um e o caminho mais curto para zerar as contas."
      />

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="flex flex-col gap-4 lg:col-span-7">
          {data.members.length === 0 && (
            <EmptyState title="Ninguém cadastrado ainda">Adicione o primeiro morador no campo abaixo.</EmptyState>
          )}
          <AnimatePresence initial={false}>
            {data.members.map((m) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              >
                <MemberCard member={m} balance={balances[m.id] ?? 0} paid={paid[m.id] ?? 0} owed={owed[m.id] ?? 0} />
              </motion.div>
            ))}
          </AnimatePresence>

          <form onSubmit={submit} className="flex flex-wrap items-start gap-2 rounded-2xl border border-dashed border-foreground/15 p-4" noValidate>
            <div className="min-w-48 flex-1">
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError(null)
                }}
                placeholder="Nome do novo morador"
                aria-label="Nome do novo morador"
                aria-invalid={!!error}
                maxLength={60}
              />
              {error && (
                <p role="alert" className="mt-1.5 text-xs text-critical">
                  {error}
                </p>
              )}
            </div>
            <Button type="submit" variant="secondary" className="press gap-2">
              <UserPlus className="size-4" /> Adicionar
            </Button>
          </form>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-5">
          <section aria-label="Como zerar as contas" className="rounded-2xl border border-border bg-card p-5">
            <p className="eyebrow">como zerar as contas</p>
            {transfers.length === 0 ? (
              <p className="mt-3 flex items-center gap-2 text-sm">
                <CircleCheck className="size-4" style={{ color: 'var(--good)' }} /> Ninguém deve nada a ninguém.
              </p>
            ) : (
              <>
                <ul className="mt-3 flex flex-col gap-3">
                  {transfers.map((t) => (
                    <li key={`${t.from_id}-${t.to_id}`} className="rounded-xl bg-muted p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <MemberAvatar member={member(t.from_id)} size="sm" />
                        <span className="truncate font-medium">{member(t.from_id)?.name}</span>
                        <ArrowRight className="size-3.5 shrink-0 text-faint" aria-label="paga a" />
                        <MemberAvatar member={member(t.to_id)} size="sm" />
                        <span className="truncate font-medium">{member(t.to_id)?.name}</span>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between gap-3">
                        <span className="num text-xl font-semibold tracking-[-0.02em]">{formatBRL(t.amount)}</span>
                        <Button size="sm" className="press gap-1.5" onClick={() => settle(t.from_id, t.to_id, t.amount)}>
                          <Check className="size-3.5" /> Marcar como pago
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-faint">
                  {transfers.length === 1 ? 'Uma transferência resolve' : `${transfers.length} transferências resolvem`} tudo. Os saldos
                  somam os gastos e as cobranças de assinatura até hoje.
                </p>
              </>
            )}
          </section>

          <section aria-label="Acertos registrados" className="rounded-2xl border border-border bg-card p-5">
            <p className="eyebrow">acertos registrados</p>
            {history.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Os pagamentos entre moradores aparecem aqui.</p>
            ) : (
              <ul className="mt-2">
                {history.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 border-t border-border py-2.5 text-sm first:border-t-0">
                    <span className="min-w-0 flex-1 truncate">
                      {member(s.from_id)?.name} pagou a {member(s.to_id)?.name}
                      <span className="text-muted-foreground"> · {formatDate(s.date)}</span>
                    </span>
                    <span className="num font-medium">{formatBRL(s.amount)}</span>
                    <Button variant="ghost" size="icon-sm" onClick={() => deleteSettlement(s.id)} aria-label="Desfazer este acerto">
                      <Undo2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  )
}

function MemberCard({ member, balance, paid, owed }: { member: Member; balance: number; paid: number; owed: number }) {
  const renameMember = useAppStore((s) => s.renameMember)
  const setMemberColor = useAppStore((s) => s.setMemberColor)
  const { dark } = useThemeColors()
  const removeMember = useAppStore((s) => s.removeMember)
  const members = useData().members
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(member.name)
  const setMemberPhoto = useAppStore((s) => s.setMemberPhoto)
  const fileRef = useRef<HTMLInputElement>(null)
  const upload = async (file: File | undefined) => {
    if (!file) return
    // a foto é recortada em quadrado e reduzida no próprio aparelho antes de ser guardada
    const result = await fileToIcon(file)
    if (result.ok) {
      setMemberPhoto(member.id, result.dataUrl)
      toast.success(`Foto de ${member.name} atualizada`)
    } else toast.error('Não foi possível usar essa foto', { description: result.error })
    if (fileRef.current) fileRef.current.value = ''
  }

  const save = (e: FormEvent) => {
    e.preventDefault()
    const clean = draft.trim()
    if (!clean) return
    if (members.some((m) => m.id !== member.id && titleKey(m.name) === titleKey(clean))) {
      toast.error('Já existe um morador com esse nome.')
      return
    }
    renameMember(member.id, clean)
    setEditing(false)
  }
  const remove = () => {
    const reason = removeMember(member.id)
    if (reason) toast.error(`Não dá para remover ${member.name}`, { description: reason })
    else toast(`${member.name} saiu da casa`)
  }

  return (
    <SpotlightCard
      className="!rounded-2xl !p-5"
      spotlightColor={member.color}
      intensity={0.1}
      borderGlow={0.35}
      flare={false}
      theme={dark ? 'dark' : 'light'}
      style={
        {
          '--spotlight-card-surface': 'var(--card)',
          '--spotlight-card-border': 'var(--border)',
          '--spotlight-card-shadow': 'none',
        } as React.CSSProperties
      }
    >
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label={member.photo ? `Trocar a foto de ${member.name}` : `Colocar uma foto em ${member.name}`}
          title={member.photo ? 'Trocar foto' : 'Colocar foto'}
          className="press relative z-[2] shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]"
        >
          <MemberAvatar member={member} size="xl" />
          <span className="absolute -right-1 -bottom-1 inline-flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground" aria-hidden="true">
            <Camera className="size-3.5" />
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-label={`Foto de ${member.name}`}
          onChange={(e) => void upload(e.target.files?.[0])}
        />
        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={save} className="flex items-center gap-2">
              <Input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
                aria-label="Nome do morador"
                className="ctl-sm max-w-48"
                maxLength={60}
              />
              <Button type="submit" size="icon-sm" aria-label="Salvar nome">
                <Check />
              </Button>
            </form>
          ) : (
            <p className="truncate text-lg font-semibold tracking-[-0.015em]">{member.name}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {balance === 0 ? 'Em dia com a casa' : balance > 0 ? 'Tem a receber' : 'Tem a pagar'}
          </p>
        </div>
        <p className="num text-right text-2xl font-semibold tracking-[-0.025em]">
          {balance === 0 ? formatBRL(0) : formatBRL(Math.abs(balance))}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 border-t border-border pt-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Pagou do próprio bolso</dt>
          <dd className="num mt-0.5 font-medium">{formatBRL(paid)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Parte que cabia a {member.name}</dt>
          <dd className="num mt-0.5 font-medium">{formatBRL(owed)}</dd>
        </div>
      </dl>

      <div className="relative z-[2] mt-3 flex flex-wrap items-center gap-1">
        <span className="mr-1 flex items-center gap-2 text-[0.8rem] text-muted-foreground">
          <ColorField id={`cor-${member.id}`} label={`Cor de ${member.name}`} value={member.color} onChange={(c) => setMemberColor(member.id, c)} compact />
          Cor
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => {
            setDraft(member.name)
            setEditing((v) => !v)
          }}
        >
          <Pencil className="size-3.5" /> Renomear
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => fileRef.current?.click()}>
          <Camera className="size-3.5" /> {member.photo ? 'Trocar foto' : 'Colocar foto'}
        </Button>
        {member.photo && (
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setMemberPhoto(member.id, null)}>
            <ImageOff className="size-3.5" /> Tirar foto
          </Button>
        )}
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={remove}>
          <Trash2 className="size-3.5" /> Remover
        </Button>
      </div>
    </SpotlightCard>
  )
}
