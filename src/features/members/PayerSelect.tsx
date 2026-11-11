import { Check, Pencil, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { titleKey } from '@/domain/wikilinks'
import { cn } from '@/lib/utils'
import { useAppStore, useData } from '@/store/useAppStore'

const NEW = '__nova_pessoa__'

/**
 * Escolhe quem paga e, no mesmo lugar, permite corrigir o nome dessa pessoa
 * ou cadastrar outra — sem precisar ir até a tela de Moradores.
 */
export function PayerSelect({
  value,
  onChange,
  label = 'Quem paga',
  className,
}: {
  value: string
  onChange: (memberId: string) => void
  label?: string
  className?: string
}) {
  const members = useData().members
  const addMember = useAppStore((s) => s.addMember)
  const renameMember = useAppStore((s) => s.renameMember)
  const [mode, setMode] = useState<'select' | 'rename' | 'new'>('select')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const current = members.find((m) => m.id === value)

  const start = (next: 'rename' | 'new') => {
    setDraft(next === 'rename' ? (current?.name ?? '') : '')
    setError(null)
    setMode(next)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const name = draft.trim()
    if (!name) return setError('Digite um nome.')
    const clash = members.some((m) => titleKey(m.name) === titleKey(name) && (mode === 'new' || m.id !== value))
    if (clash) return setError('Já existe alguém com esse nome.')
    if (mode === 'rename' && current) {
      if (name !== current.name) {
        renameMember(current.id, name)
        toast.success(`${current.name} agora se chama ${name}`, { description: 'O nome mudou em todos os gastos e assinaturas.' })
      }
    } else {
      const created = addMember(name)
      onChange(created.id)
      toast.success(`${name} foi adicionado à casa`)
    }
    setMode('select')
  }

  if (mode !== 'select') {
    return (
      <form onSubmit={submit} className={cn('flex flex-wrap items-center gap-1.5', className)} noValidate>
        <Input
          autoFocus
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => e.key === 'Escape' && setMode('select')}
          placeholder={mode === 'new' ? 'Nome da nova pessoa' : 'Nome'}
          aria-label={mode === 'new' ? 'Nome da nova pessoa' : `Novo nome de ${current?.name ?? 'quem paga'}`}
          aria-invalid={!!error}
          maxLength={60}
          className="ctl-sm w-40"
        />
        <Button type="submit" size="icon-sm" aria-label="Salvar nome">
          <Check />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Cancelar" onClick={() => setMode('select')}>
          <X />
        </Button>
        {error && (
          <span role="alert" className="w-full text-xs text-critical">
            {error}
          </span>
        )}
      </form>
    )
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Select value={value} onValueChange={(v) => (v === NEW ? start('new') : onChange(v))}>
        <SelectTrigger className="ctl-sm w-36" aria-label={label}>
          <SelectValue placeholder="Escolha" />
        </SelectTrigger>
        <SelectContent>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
          <SelectItem value={NEW}>Nova pessoa…</SelectItem>
        </SelectContent>
      </Select>
      {current && (
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar o nome de ${current.name}`} title="Editar o nome" onClick={() => start('rename')}>
          <Pencil />
        </Button>
      )}
    </div>
  )
}
