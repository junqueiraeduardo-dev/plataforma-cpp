import { Check, ChevronDown, Minus, Plus, ReceiptText, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useRef, useState, type ClipboardEvent, type FormEvent } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { MarketSection, ShoppingItem } from '@/domain/types'
import { titleKey } from '@/domain/wikilinks'
import { cn } from '@/lib/utils'
import { useAppStore, useData } from '@/store/useAppStore'
import { useUi } from '@/store/useUi'
import { SECTIONS, sectionById } from './catalog'
import { guessSection, parseItems, suggest } from './parseItems'

export function MarketPage() {
  const data = useData()
  const openNew = useUi((s) => s.openNewTransaction)
  const clearChecked = useAppStore((s) => s.clearChecked)
  const restoreItem = useAppStore((s) => s.restoreItem)

  const items = data.shopping
  const pending = items.filter((i) => !i.checked)
  const done = items.filter((i) => i.checked)
  const progress = items.length ? done.length / items.length : 0

  const clear = () => {
    const removed = clearChecked()
    if (removed.length === 0) return
    toast(`${removed.length} ${removed.length === 1 ? 'item saiu' : 'itens saíram'} da lista`, {
      action: { label: 'Desfazer', onClick: () => removed.forEach(restoreItem) },
    })
  }

  return (
    // no celular o campo de digitar fica fixo embaixo; a folga evita que ele cubra o fim da lista
    <div className="pb-36 md:pb-0">
      <PageHeader
        title="Mercado"
        description="Escreva o que precisa comprar, um item por vez ou vários de uma só vez. No mercado, marque o que já foi para o carrinho."
        actions={
          <>
            <Button variant="secondary" className="press gap-2" onClick={clear} disabled={done.length === 0}>
              <Trash2 className="size-4" /> Tirar comprados
            </Button>
            <Button
              className="press gap-2"
              onClick={() => openNew({ description: 'Compra no mercado', category_id: 'mercado' })}
              disabled={data.members.length === 0}
            >
              <ReceiptText className="size-4" /> Registrar a compra
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          <Composer />

          <section aria-label="Lista de compras" className="rounded-2xl border border-border bg-card">
            <div className="border-b border-border p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-[-0.015em]">Lista de compras</h2>
                <p className="num text-sm text-muted-foreground" aria-live="polite">
                  <span className="font-semibold text-foreground">{done.length}</span> de {items.length} no carrinho
                </p>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10" aria-hidden="true">
                <div
                  className="h-full origin-left rounded-full bg-primary transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)]"
                  style={{ transform: `scaleX(${progress})` }}
                />
              </div>
            </div>

            {items.length === 0 ? (
              <div className="p-5">
                <p className="font-medium">A lista está vazia</p>
                <p className="mt-1 max-w-[46ch] text-sm text-muted-foreground">
                  Escreva o primeiro item no campo {`"O que falta comprar?"`}. Dá para escrever a quantidade junto, como em{' '}
                  <span className="text-foreground">2 leite</span>, ou colar uma lista inteira.
                </p>
              </div>
            ) : (
              <>
                {pending.length === 0 && <p className="px-5 pt-4 text-sm text-muted-foreground">Tudo no carrinho. Boa compra!</p>}
                {SECTIONS.map((section) => {
                  const list = pending.filter((i) => i.section === section.id).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                  if (list.length === 0) return null
                  return (
                    <div key={section.id} className="border-t border-border first:border-t-0">
                      <h3 className="eyebrow flex items-center gap-2 px-5 pt-4 pb-1">
                        <section.Icon className="size-3.5" /> {section.name}
                      </h3>
                      <ItemList items={list} />
                    </div>
                  )
                })}
                {done.length > 0 && <Cart items={done} />}
              </>
            )}
          </section>
        </div>

        <Frequent />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ campo de digitar */

function Composer() {
  const data = useData()
  const addItems = useAppStore((s) => s.addItems)
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const inList = useMemo(() => new Set(data.shopping.filter((i) => !i.checked).map((i) => titleKey(i.name))), [data.shopping])
  const suggestions = useMemo(() => suggest(text, data.products, inList), [text, data.products, inList])

  const add = (raw: string) => {
    const parsed = parseItems(raw)
    if (parsed.length === 0) {
      setError('Escreva o nome de um item.')
      return
    }
    addItems(parsed.map((p) => ({ ...p, section: guessSection(p.name, data.products) })))
    setText('')
    setError(null)
    if (parsed.length > 1) toast.success(`${parsed.length} itens na lista`)
    inputRef.current?.focus()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    add(text)
  }
  // um <input> de uma linha engoliria as quebras: lista colada entra direto, item por item
  const paste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text')
    if (!/[\n\r]/.test(pasted.trim())) return
    e.preventDefault()
    add(`${text}\n${pasted}`)
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-20 border-t border-border bg-background px-5 pt-2.5 pb-3 md:static md:z-auto md:mb-4 md:border-0 md:bg-transparent md:p-0"
    >
      {suggestions.length > 0 && (
        <div className="-mx-5 mb-2 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:mb-2.5 md:flex-wrap md:px-0" aria-label="Sugestões">
          {suggestions.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => add(s.name)}
              className="press inline-flex ctl-sm shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm outline-none hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="size-3.5 text-muted-foreground" /> {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <label htmlFor="mercado-item" className="sr-only">
          O que falta comprar?
        </label>
        <Input
          ref={inputRef}
          id="mercado-item"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setError(null)
          }}
          onPaste={paste}
          placeholder="O que falta comprar?"
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="done"
          aria-invalid={!!error}
          aria-describedby="mercado-ajuda"
          maxLength={400}
          className="h-12 flex-1 text-base md:h-12"
        />
        <Button type="submit" className="press h-12 gap-2 px-4 md:h-12" aria-label="Adicionar à lista">
          <Plus className="size-5" /> <span className="hidden sm:inline">Adicionar</span>
        </Button>
      </div>
      <p id="mercado-ajuda" role={error ? 'alert' : undefined} className={cn('mt-1.5 hidden text-xs md:block', error ? '!block text-critical' : 'text-faint')}>
        {error ?? 'Enter adiciona. Separe vários itens com vírgula; "2 leite" e "2 kg tomate" também funcionam.'}
      </p>
    </form>
  )
}

/* ------------------------------------------------------------------ lista */

function ItemList({ items }: { items: ShoppingItem[] }) {
  return (
    <ul className="px-2 pb-2">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.li
            key={item.id}
            layout="position"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
          >
            <ItemRow item={item} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}

function ItemRow({ item }: { item: ShoppingItem }) {
  const toggleItem = useAppStore((s) => s.toggleItem)
  const setQuantity = useAppStore((s) => s.setQuantity)
  const renameItem = useAppStore((s) => s.renameItem)
  const setItemSection = useAppStore((s) => s.setItemSection)
  const removeItem = useAppStore((s) => s.removeItem)
  const restoreItem = useAppStore((s) => s.restoreItem)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.name)
  // a seção só é aplicada ao concluir: trocá-la na hora moveria a linha de grupo e fecharia a edição
  const [section, setSection] = useState(item.section)

  const remove = () => {
    removeItem(item.id)
    toast(`${item.name} saiu da lista`, { action: { label: 'Desfazer', onClick: () => restoreItem(item) } })
  }
  const save = (e?: FormEvent) => {
    e?.preventDefault()
    setItemSection(item.id, section)
    renameItem(item.id, draft)
    setEditing(false)
  }

  if (editing) {
    return (
      <form onSubmit={save} className="my-1 flex flex-col gap-2 rounded-xl bg-muted p-3">
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
          aria-label={`Nome de ${item.name}`}
          maxLength={60}
          enterKeyHint="done"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-40 flex-1 items-center gap-2 text-sm text-muted-foreground">
            Seção
            <select
              value={section}
              onChange={(e) => setSection(e.target.value as MarketSection)}
              className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-card px-2.5 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10 md:text-sm"
            >
              {SECTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" variant="ghost" className="gap-2 text-muted-foreground" onClick={remove}>
            <Trash2 className="size-4" /> Remover
          </Button>
          <Button type="submit" className="gap-2">
            <Check className="size-4" /> Pronto
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex min-h-13 items-center gap-1 rounded-lg px-1 hover:bg-foreground/[0.03]">
      <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
        <input type="checkbox" checked={item.checked} onChange={() => toggleItem(item.id)} className="peer sr-only" />
        <span className="sr-only">{item.checked ? `Tirar ${item.name} do carrinho` : `Pôr ${item.name} no carrinho`}</span>
        <span
          aria-hidden="true"
          className={cn(
            'flex size-6 items-center justify-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
            item.checked ? 'border-primary bg-primary text-primary-foreground' : 'border-foreground/40',
          )}
        >
          {item.checked && <Check className="size-4" strokeWidth={3} />}
        </span>
      </label>
      <button
        type="button"
        onClick={() => {
          setDraft(item.name)
          setSection(item.section)
          setEditing(true)
        }}
        aria-label={`Editar ${item.name}`}
        className="min-h-11 min-w-0 flex-1 rounded-md px-1 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className={cn('block break-words', item.checked && 'text-muted-foreground line-through')}>{item.name}</span>
        {item.detail && <span className="block text-xs text-muted-foreground">{item.detail}</span>}
      </button>
      {!item.checked && (
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => setQuantity(item.id, item.quantity - 1)}
            disabled={item.quantity <= 1}
            aria-label={`Diminuir ${item.name}`}
            className="press inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 md:size-9"
          >
            <Minus className="size-4" />
          </button>
          <span className="num w-6 text-center text-sm font-semibold" aria-label={`Quantidade de ${item.name}: ${item.quantity}`}>
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity(item.id, item.quantity + 1)}
            aria-label={`Aumentar ${item.name}`}
            className="press inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:size-9"
          >
            <Plus className="size-4" />
          </button>
        </div>
      )}
      {item.checked && item.quantity > 1 && <span className="num pr-3 text-sm text-muted-foreground">×{item.quantity}</span>}
    </div>
  )
}

/** O que já foi para o carrinho: fica no fim, recolhido para não atrapalhar o que falta. */
function Cart({ items }: { items: ShoppingItem[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-13 w-full items-center gap-2 px-5 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        No carrinho
        <span className="num font-normal text-muted-foreground">{items.length}</span>
        <ChevronDown className={cn('ml-auto size-4 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && <ItemList items={[...items].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))} />}
    </div>
  )
}

/* ------------------------------------------------------- itens da casa */

function Frequent() {
  const data = useData()
  const addItems = useAppStore((s) => s.addItems)
  const removeProduct = useAppStore((s) => s.removeProduct)
  const restoreProduct = useAppStore((s) => s.restoreProduct)
  const [managing, setManaging] = useState(false)

  const inList = new Set(data.shopping.filter((i) => !i.checked).map((i) => titleKey(i.name)))
  const products = [...data.products].sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0) || a.name.localeCompare(b.name, 'pt-BR')).slice(0, 24)

  if (products.length === 0) return null
  return (
    <aside aria-label="Itens da casa" className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Itens da casa</h2>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setManaging((v) => !v)} aria-pressed={managing}>
          {managing ? 'Concluir' : 'Editar'}
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {managing ? 'Toque em um item para esquecê-lo.' : 'O que vocês já escreveram antes. Toque para pôr na lista.'}
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {products.map((p) => {
          const present = inList.has(titleKey(p.name))
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={!managing && present}
                onClick={() => {
                  if (managing) {
                    removeProduct(p.id)
                    toast(`${p.name} saiu das sugestões`, { action: { label: 'Desfazer', onClick: () => restoreProduct(p) } })
                  } else {
                    addItems([{ name: p.name, quantity: 1, detail: null, section: p.section }])
                  }
                }}
                aria-label={managing ? `Esquecer ${p.name}` : present ? `${p.name} já está na lista` : `Pôr ${p.name} na lista`}
                title={sectionById.get(p.section)?.name}
                className={cn(
                  'press inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9',
                  managing ? 'border-critical/50 text-foreground' : present ? 'border-border text-faint' : 'border-border hover:border-foreground/25',
                )}
              >
                {managing ? <X className="size-3.5" /> : present ? <Check className="size-3.5" /> : <Plus className="size-3.5 text-muted-foreground" />}
                {p.name}
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
