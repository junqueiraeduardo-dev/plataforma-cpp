import { Check, Eye, FilePlus2, Link2, PenLine, Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AnimatedNumber } from '@/components/common/AnimatedNumber'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { Segmented } from '@/components/common/Segmented'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, relativeDay } from '@/domain/dates'
import { formatBRL, formatBRLRound } from '@/domain/money'
import { CYCLE_SUFFIX } from '@/domain/subscriptions'
import type { Note, NoteKind } from '@/domain/types'
import { backlinksFor, buildGraph, findNoteByTitle, localGraph, titleKey, type GraphNode } from '@/domain/wikilinks'
import { cn } from '@/lib/utils'
import { useSubscriptions, useToday, type SubscriptionRow } from '@/store/selectors'
import { useAppStore, useData } from '@/store/useAppStore'
import { GraphView } from './GraphView'
import { KindGlyph } from './KindGlyph'
import { KIND, KIND_ORDER } from './kinds'
import { NewSubscriptionDialog } from './NewSubscriptionDialog'
import { NoteEditor } from './NoteEditor'
import { NoteReader } from './NoteReader'
import { PayerGraph } from './PayerGraph'
import { PropertiesPanel } from './PropertiesPanel'
import { SubscriptionGallery } from './SubscriptionGallery'
import { SubscriptionIcon } from './SubscriptionIcon'

type Mode = 'read' | 'edit'
type MobileTab = 'lista' | 'nota' | 'conexoes'
type View = 'cartoes' | 'notas' | 'grafo'

export default function VaultPage() {
  const data = useData()
  const todayISO = useToday()
  const subs = useSubscriptions()
  const navigate = useNavigate()
  const { noteId } = useParams()
  const [params] = useSearchParams()
  // abre na galeria de cartões; uma nota na URL leva direto às notas
  const v = params.get('v')
  const view: View = v === 'grafo' ? 'grafo' : noteId || v === 'notas' ? 'notas' : 'cartoes'
  const setView = (next: View) => {
    if (next === 'cartoes') navigate('/assinaturas', { replace: true })
    else if (next === 'grafo') navigate('/assinaturas?v=grafo', { replace: true })
    else navigate(noteId ? `/assinaturas/${noteId}` : '/assinaturas?v=notas', { replace: true })
  }
  const createNote = useAppStore((s) => s.createNote)

  const [mode, setMode] = useState<Mode>('read')
  const [mobileTab, setMobileTab] = useState<MobileTab>(noteId ? 'nota' : 'lista')
  const [query, setQuery] = useState('')

  const graph = useMemo(() => buildGraph(data.notes, data.members), [data.notes, data.members])

  // sem nota na URL, o desktop abre a assinatura mais cara; o celular fica na lista
  const fallback = useMemo(
    () => [...subs.active].sort((a, b) => b.monthly - a.monthly)[0]?.note ?? data.notes[0],
    [subs.active, data.notes],
  )
  const selected = data.notes.find((n) => n.id === noteId) ?? (noteId ? undefined : fallback)

  const openNote = useCallback(
    (id: string) => {
      navigate(`/assinaturas/${id}`)
      setMobileTab('nota')
    },
    [navigate],
  )

  /** Segue um [[link]]: abre a nota ou cria uma nova com aquele título. */
  const openTitle = useCallback(
    (title: string, kind: NoteKind = 'note') => {
      const found = findNoteByTitle(useAppStore.getState().data.notes, title)
      if (found) return openNote(found.id)
      const created = createNote(title, kind)
      setMode('edit')
      openNote(created.id)
      toast.success(`Nota "${created.title}" criada`)
    },
    [createNote, openNote],
  )

  const openNode = useCallback(
    (node: GraphNode) => {
      if (node.note_id) openNote(node.note_id)
      // morador, grupo ou pagamento sem nota: a nota nasce já com o tipo certo
      else openTitle(node.title, node.kind === 'ghost' || node.kind === 'subscription' ? 'note' : node.kind)
    },
    [openNote, openTitle],
  )

  // a assinatura só passa a existir quando o formulário é confirmado
  const [creating, setCreating] = useState(false)
  const newSubscription = () => setCreating(true)
  const newNote = () => {
    const created = createNote('Nova nota', 'note')
    setMode('edit')
    openNote(created.id)
  }

  const next = subs.upcoming[0]
  const stat = 'rounded-2xl border border-border bg-card px-4 py-3.5'
  const reais = (v: number) => `R$ ${v.toLocaleString('pt-BR')}`

  return (
    <>
      <PageHeader
        title="Assinaturas"
        description="Cada assinatura tem um cartão e uma nota. O grafo mostra quem paga o quê."
        actions={
          <>
            <Button variant="secondary" className="press gap-2" onClick={newNote}>
              <FilePlus2 className="size-4" /> Nota
            </Button>
            <Button className="press gap-2" onClick={newSubscription} disabled={data.members.length === 0}>
              <Plus className="size-4" /> Assinatura
            </Button>
          </>
        }
      />

      <NewSubscriptionDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={() => {
          setCreating(false)
          // volta aos cartões, onde a assinatura nova aparece
          if (view !== 'cartoes') navigate('/assinaturas', { replace: true })
        }}
      />

      {/* no celular o seletor acompanha a rolagem; fundo opaco para o conteúdo não aparecer por trás */}
      <div className="sticky top-0 z-20 -mx-5 mb-4 bg-background px-5 py-2 md:static md:mx-0 md:mb-5 md:bg-transparent md:p-0">
        <Segmented
          label="Visualização"
          value={view}
          onChange={setView}
          options={[
            { value: 'cartoes', label: 'Cartões' },
            { value: 'notas', label: 'Notas' },
            { value: 'grafo', label: 'Grafo' },
          ]}
          className="w-full md:w-80"
        />
      </div>

      {/* resumo: quatro cartões com o mesmo tratamento */}
      <dl className={cn('grid-cols-2 gap-3 md:grid md:gap-4 lg:grid-cols-4', view === 'grafo' ? 'hidden' : 'grid', view === 'cartoes' ? 'mb-8' : 'mb-4')}>
        <div className={stat}>
          <dt className="eyebrow">custo mensal</dt>
          <dd className="mt-1 text-2xl font-semibold tracking-[-0.025em]">
            <span className="sr-only">{formatBRLRound(subs.monthly)}</span>
            <span aria-hidden="true">
              <AnimatedNumber value={Math.round(subs.monthly / 100)} format={reais} className="num" />
            </span>
          </dd>
        </div>
        <div className={stat}>
          <dt className="eyebrow">por ano</dt>
          <dd className="mt-1 text-2xl font-semibold tracking-[-0.025em]">
            <span className="sr-only">{formatBRLRound(subs.yearly)}</span>
            <span aria-hidden="true">
              <AnimatedNumber value={Math.round(subs.yearly / 100)} format={reais} className="num" />
            </span>
          </dd>
        </div>
        <div className={stat}>
          <dt className="eyebrow">próxima cobrança</dt>
          <dd className="mt-1 line-clamp-2 text-base leading-snug font-semibold">
            {next ? (
              <>
                {next.note.title}{' '}
                <span className="font-normal text-muted-foreground">
                  · {relativeDay(next.next!, todayISO)} · {formatBRL(next.sub.price)}
                </span>
              </>
            ) : (
              <span className="font-normal text-muted-foreground">Nenhuma</span>
            )}
          </dd>
        </div>
        <div className={stat}>
          <dt className="eyebrow">ativas · paradas</dt>
          <dd className="num mt-1 text-2xl font-semibold tracking-[-0.025em]">
            <AnimatedNumber value={subs.active.length} format={String} duration={0.5} />
            <span className="text-base font-normal text-muted-foreground"> · {subs.inactive.length}</span>
          </dd>
        </div>
      </dl>

      {view === 'grafo' ? (
        <GlobalGraph graph={graph} rows={subs.rows} onOpen={openNode} onOpenNote={openNote} />
      ) : view === 'cartoes' && subs.rows.length > 0 ? (
        <SubscriptionGallery rows={subs.rows} onOpen={openNote} />
      ) : view === 'cartoes' ? (
        <EmptyState
          title="Nenhuma assinatura cadastrada"
          action={
            <Button onClick={newSubscription} disabled={data.members.length === 0}>
              Criar a primeira assinatura
            </Button>
          }
        >
          Cada assinatura ganha um cartão com ícone, preço, próxima cobrança e quem paga.
          {data.members.length === 0 ? ' Cadastre um morador antes, em Moradores.' : ''}
        </EmptyState>
      ) : data.notes.length === 0 ? (
        <EmptyState
          title="O cofre está vazio"
          action={
            <Button onClick={data.members.length ? newSubscription : newNote}>
              {data.members.length ? 'Criar a primeira assinatura' : 'Criar a primeira nota'}
            </Button>
          }
        >
          Crie uma nota para cada assinatura e ligue-as com [[colchetes duplos]]. O grafo se monta sozinho.
        </EmptyState>
      ) : (
        <>
          <Segmented
            label="Painel"
            value={mobileTab}
            onChange={setMobileTab}
            options={[
              { value: 'lista', label: 'Notas' },
              { value: 'nota', label: 'Nota aberta' },
              { value: 'conexoes', label: 'Conexões' },
            ]}
            className="mb-3 lg:hidden"
          />
          <div className="grid gap-3 lg:grid-cols-[16.5rem_minmax(0,1fr)_19rem]">
            {/* lista */}
            <aside
              aria-label="Notas do cofre"
              className={cn(
                'rounded-2xl border border-border bg-card lg:flex lg:h-[calc(100dvh-17.5rem)] lg:min-h-[30rem] lg:flex-col',
                mobileTab === 'lista' ? 'flex flex-col' : 'hidden',
              )}
            >
              <div className="relative border-b border-border p-2.5">
                <Search className="pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar nota"
                  aria-label="Buscar nota"
                  className="ctl-sm pl-8"
                />
              </div>
              <NoteList notes={data.notes} query={query} selectedId={selected?.id} onOpen={openNote} />
            </aside>

            {/* nota */}
            <section
              aria-label="Nota aberta"
              className={cn(
                'min-w-0 rounded-2xl border border-border bg-card lg:block lg:h-[calc(100dvh-17.5rem)] lg:min-h-[30rem] lg:overflow-y-auto',
                mobileTab === 'nota' ? 'block' : 'hidden',
              )}
            >
              {selected ? (
                <NotePane key={selected.id} note={selected} mode={mode} setMode={setMode} onOpenTitle={(t) => openTitle(t)} />
              ) : (
                <div className="p-6">
                  <p className="font-medium">Esta nota não existe mais.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Escolha outra na lista ao lado.</p>
                </div>
              )}
            </section>

            {/* conexões */}
            <aside
              aria-label="Conexões da nota"
              className={cn(
                'flex-col gap-3 lg:flex lg:h-[calc(100dvh-17.5rem)] lg:min-h-[30rem] lg:overflow-y-auto',
                mobileTab === 'conexoes' ? 'flex' : 'hidden',
              )}
            >
              {selected && <Connections note={selected} graph={graph} onOpen={openNode} onOpenNote={openNote} />}
            </aside>
          </div>
        </>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ lista */

function NoteList({
  notes,
  query,
  selectedId,
  onOpen,
}: {
  notes: Note[]
  query: string
  selectedId: string | undefined
  onOpen: (id: string) => void
}) {
  const q = titleKey(query)
  const groups = KIND_ORDER.map((kind) => ({
    kind,
    items: notes
      .filter((n) => n.kind === kind && (!q || titleKey(n.title).includes(q) || titleKey(n.body).includes(q)))
      .sort((a, b) =>
        kind === 'subscription'
          ? Number(b.subscription?.status === 'active') - Number(a.subscription?.status === 'active') ||
            a.title.localeCompare(b.title, 'pt-BR')
          : a.title.localeCompare(b.title, 'pt-BR'),
      ),
  })).filter((g) => g.items.length > 0)

  if (groups.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">Nenhuma nota com "{query}".</p>
  }
  return (
    <nav className="min-h-0 flex-1 overflow-y-auto p-2">
      {groups.map((g) => (
        <div key={g.kind} className="mb-3 last:mb-0">
          <p className="eyebrow flex items-center gap-2 px-2 py-1.5">
            <KindGlyph kind={g.kind} /> {KIND[g.kind].plural} <span className="num ml-auto">{g.items.length}</span>
          </p>
          <ul>
            {g.items.map((n) => {
              const sub = n.subscription
              const active = n.id === selectedId
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(n.id)}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'press flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9',
                      active ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
                    )}
                  >
                    {sub && <SubscriptionIcon note={n} size="xs" className={cn(sub.status !== 'active' && 'opacity-50')} />}
                    <span className={cn('min-w-0 flex-1 truncate', sub && sub.status !== 'active' && 'line-through decoration-foreground/30')}>
                      {n.title}
                    </span>
                    {sub && (
                      <span className="num shrink-0 text-xs text-muted-foreground">
                        {sub.status === 'active'
                          ? `${formatBRL(sub.price).replace('R$', '').trim()}${CYCLE_SUFFIX[sub.cycle]}`
                          : sub.status === 'paused'
                            ? 'pausada'
                            : 'cancelada'}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/* ------------------------------------------------------------------- nota */

const NOTE_KINDS: { value: NoteKind; label: string }[] = [
  { value: 'note', label: 'Nota' },
  { value: 'group', label: 'Grupo' },
  { value: 'member', label: 'Morador' },
  { value: 'payment', label: 'Pagamento' },
]

function NotePane({
  note,
  mode,
  setMode,
  onOpenTitle,
}: {
  note: Note
  mode: Mode
  setMode: (m: Mode) => void
  onOpenTitle: (title: string) => void
}) {
  const data = useData()
  const navigate = useNavigate()
  const updateNote = useAppStore((s) => s.updateNote)
  const deleteNote = useAppStore((s) => s.deleteNote)
  const restoreNote = useAppStore((s) => s.restoreNote)

  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  const [saved, setSaved] = useState(true)

  // grava o texto com um pequeno atraso e garante a gravação ao sair da nota
  const pending = useRef<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    if (pending.current !== null) {
      updateNote(note.id, { body: pending.current })
      pending.current = null
      setSaved(true)
    }
  }, [note.id, updateNote])
  useEffect(() => flush, [flush])
  useEffect(() => {
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [flush])

  const onBody = (value: string) => {
    setBody(value)
    setSaved(false)
    pending.current = value
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, 350)
  }

  // um link em outra nota pode ser reescrito quando esta é renomeada em outro lugar
  useEffect(() => {
    if (pending.current === null && note.body !== body) setBody(note.body)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.body])
  useEffect(() => setTitle(note.title), [note.title])

  const commitTitle = () => {
    const clean = title.trim()
    if (!clean) return setTitle(note.title)
    if (clean === note.title) return
    const clash = data.notes.some((n) => n.id !== note.id && titleKey(n.title) === titleKey(clean))
    if (clash) {
      toast.error(`Já existe uma nota chamada "${clean}"`, { description: 'Escolha outro título para não confundir os links.' })
      return setTitle(note.title)
    }
    flush()
    updateNote(note.id, { title: clean })
  }

  const remove = () => {
    flush()
    const snapshot = useAppStore.getState().data.notes.find((n) => n.id === note.id) ?? note
    deleteNote(note.id)
    navigate('/assinaturas')
    toast(`"${snapshot.title}" excluída`, {
      action: {
        label: 'Desfazer',
        onClick: () => {
          restoreNote(snapshot)
          navigate(`/assinaturas/${snapshot.id}`)
        },
      },
    })
  }

  const titles = useMemo(() => {
    const all = new Map<string, string>()
    for (const n of data.notes) if (n.id !== note.id) all.set(titleKey(n.title), n.title)
    return [...all.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [data.notes, note.id])
  const exists = useCallback(
    (t: string) => !!findNoteByTitle(useAppStore.getState().data.notes, t),
    // a lista de notas entra como dependência para recalcular quando notas são criadas ou removidas
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.notes],
  )

  const sub = note.kind === 'subscription' ? note.subscription : null
  const byKind = (kind: NoteKind) => data.notes.filter((n) => n.kind === kind).map((n) => n.title)

  return (
    <article className="flex min-h-full flex-col px-5 py-5 sm:px-8 sm:py-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow flex items-center gap-2">
          <KindGlyph kind={note.kind} /> {KIND[note.kind].label}
        </span>
        {note.kind !== 'subscription' && (
          <Select value={note.kind} onValueChange={(v) => updateNote(note.id, { kind: v as NoteKind })}>
            <SelectTrigger className="ctl-sm w-32 text-xs" aria-label="Tipo da nota">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NOTE_KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          <span className="mr-1 text-xs text-faint" aria-live="polite">
            {saved ? 'Salvo' : 'Salvando…'}
          </span>
          <div className="flex rounded-lg bg-muted p-0.5" role="group" aria-label="Modo da nota">
            {(
              [
                ['read', Eye, 'Leitura'],
                ['edit', PenLine, 'Edição'],
              ] as const
            ).map(([key, Icon, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                aria-pressed={mode === key}
                className={cn(
                  'press inline-flex ctl-sm items-center gap-1.5 rounded-md px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  mode === key ? 'bg-accent font-medium text-foreground ring-1 ring-foreground/10' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={remove} aria-label={`Excluir a nota ${note.title}`}>
            <Trash2 />
          </Button>
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        {sub && <SubscriptionIcon note={note} size="md" />}
        <input
          value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setTitle(note.title)
            e.currentTarget.blur()
          }
        }}
        aria-label="Título da nota"
        maxLength={120}
        className="w-full min-w-0 rounded-md bg-transparent text-[1.75rem] leading-tight font-semibold tracking-[-0.025em] outline-none placeholder:text-faint focus-visible:bg-foreground/5"
        placeholder="Sem título"
      />

      </div>

      {sub && (
        <div className="mt-4">
          <PropertiesPanel
            title={note.title}
            sub={sub}
            members={data.members}
            groups={byKind('group')}
            payments={byKind('payment')}
            onChange={(next) => updateNote(note.id, { subscription: next })}
          />
        </div>
      )}

      <div className="mt-5 flex-1">
        {mode === 'edit' ? (
          <NoteEditor value={body} onChange={onBody} titles={titles} exists={exists} onOpen={onOpenTitle} />
        ) : (
          <NoteReader body={body} exists={exists} onOpen={onOpenTitle} />
        )}
      </div>

      {sub && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3">
          <p className="text-sm text-muted-foreground">Tudo o que você muda aqui é salvo na hora.</p>
          <Button
            className="press gap-2"
            onClick={() => {
              flush()
              navigate('/assinaturas')
            }}
          >
            <Check className="size-4" /> Concluir
          </Button>
        </div>
      )}

      <p className="mt-6 border-t border-border pt-3 text-xs text-faint">
        {mode === 'edit'
          ? 'Digite [[ para ligar a outra nota. Ctrl/Cmd + clique em um link para abri-lo.'
          : 'Clique em um link para abrir a nota; links tracejados criam a nota que ainda não existe.'}{' '}
        Atualizada em {formatDate(note.updated_at.slice(0, 10), "d 'de' MMM 'de' yyyy")}.
      </p>
    </article>
  )
}

/* --------------------------------------------------------------- conexões */

function Connections({
  note,
  graph,
  onOpen,
  onOpenNote,
}: {
  note: Note
  graph: ReturnType<typeof buildGraph>
  onOpen: (node: GraphNode) => void
  onOpenNote: (id: string) => void
}) {
  const data = useData()
  const center = titleKey(note.title)
  const local = useMemo(() => localGraph(graph, center), [graph, center])
  const backlinks = useMemo(() => backlinksFor(note, data.notes, data.members), [note, data.notes, data.members])
  const outgoing = local.nodes.filter((n) => n.id !== center)

  return (
    <>
      <section className="rounded-2xl border border-border bg-card p-3">
        <p className="eyebrow px-1 pb-1">grafo local</p>
        {local.nodes.length > 1 ? (
          <GraphView graph={local} centerId={center} height={230} onOpen={onOpen} showAllLabels />
        ) : (
          <p className="px-1 py-6 text-sm text-muted-foreground">Esta nota ainda não se liga a nenhuma outra.</p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="eyebrow flex items-center gap-2">
          <Link2 className="size-3.5" /> citada em · {backlinks.length}
        </p>
        {backlinks.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma nota aponta para esta.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1">
            {backlinks.map((b) => (
              <li key={b.note.id}>
                <button
                  type="button"
                  onClick={() => onOpenNote(b.note.id)}
                  className="press -mx-2 flex w-[calc(100%+1rem)] flex-col rounded-lg px-2 py-1.5 text-left outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <KindGlyph kind={b.note.kind} /> {b.note.title}
                  </span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {b.snippet || 'Ligada pelas propriedades da assinatura.'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="eyebrow">todas as ligações · {outgoing.length}</p>
        {outgoing.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Sem ligações.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {outgoing.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onOpen(n)}
                  className="press inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs outline-none hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <KindGlyph kind={n.kind} /> {n.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

/* ------------------------------------------------------------ grafo geral */

function GlobalGraph({
  graph,
  rows,
  onOpen,
  onOpenNote,
}: {
  graph: ReturnType<typeof buildGraph>
  rows: SubscriptionRow[]
  onOpen: (node: GraphNode) => void
  onOpenNote: (id: string) => void
}) {
  const members = useData().members
  const [mode, setMode] = useState<'quem' | 'ligacoes'>('quem')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [inactive, setInactive] = useState(true)
  const [labels, setLabels] = useState(false)

  const filtered = useMemo(() => {
    const nodes = graph.nodes.filter((n) => !hidden.has(n.kind) && (inactive || !n.inactive))
    const keep = new Set(nodes.map((n) => n.id))
    const links = graph.links.filter((l) => keep.has(l.source) && keep.has(l.target))
    const degree = new Map<string, number>()
    for (const l of links) {
      degree.set(l.source, (degree.get(l.source) ?? 0) + 1)
      degree.set(l.target, (degree.get(l.target) ?? 0) + 1)
    }
    return { nodes: nodes.map((n) => ({ ...n, degree: degree.get(n.id) ?? 0 })), links }
  }, [graph, hidden, inactive])
  const payerRows = useMemo(() => rows.filter((r) => inactive || r.sub.status === 'active'), [rows, inactive])

  const kinds = [...KIND_ORDER, 'ghost' as const].filter((k) => graph.nodes.some((n) => n.kind === k))
  const chip =
    'press inline-flex ctl-sm items-center gap-1.5 rounded-full border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-xs'
  const graphHeight = 'clamp(24rem, calc(100dvh - 25rem), 48rem)'

  return (
    <section aria-label="Grafo do cofre" className="rounded-2xl border border-border bg-card p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented
          label="Tipo de grafo"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'quem', label: 'Quem paga' },
            { value: 'ligacoes', label: 'Ligações' },
          ]}
          className="w-full sm:w-80"
        />
        <button type="button" aria-pressed={inactive} onClick={() => setInactive((v) => !v)} className={cn(chip, 'sm:ml-auto', inactive ? 'border-foreground/20' : 'border-border text-faint')}>
          Pausadas e canceladas
        </button>
      </div>

      {mode === 'quem' ? (
        payerRows.length === 0 ? (
          <p className="px-1 py-16 text-center text-sm text-muted-foreground">Nenhuma assinatura para mostrar.</p>
        ) : (
          <>
            <PayerGraph rows={payerRows} members={members} height={graphHeight} onOpenNote={onOpenNote} />
            <p className="px-1 pt-2 text-xs text-faint">
              No centro de cada grupo está quem paga; ao redor, as assinaturas dessa pessoa (círculo maior, assinatura mais cara). Toque na pessoa para
              aproximar o grupo dela e em uma assinatura para abrir a nota.
            </p>
          </>
        )
      ) : (
        <>
          {/* filtros em uma linha, acima do que afetam; os chips também servem de legenda */}
          <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-2 pb-2 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-1 [&>button]:shrink-0">
            {kinds.map((k) => {
              const on = !hidden.has(k)
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setHidden((prev) => {
                      const next = new Set(prev)
                      if (next.has(k)) next.delete(k)
                      else next.add(k)
                      return next
                    })
                  }
                  className={cn(chip, on ? 'border-foreground/20 text-foreground' : 'border-border text-faint line-through')}
                >
                  <KindGlyph kind={k} /> {KIND[k].plural}
                </button>
              )
            })}
            <button type="button" aria-pressed={labels} onClick={() => setLabels((v) => !v)} className={cn(chip, labels ? 'border-foreground/20' : 'border-border text-faint')}>
              Todos os rótulos
            </button>
          </div>
          <p className="px-1 pb-1 text-xs text-faint">
            {filtered.nodes.length} nós · {filtered.links.length} ligações · círculo maior, assinatura mais cara
          </p>
          {filtered.nodes.length === 0 ? (
            <p className="px-1 py-16 text-center text-sm text-muted-foreground">Nenhum nó com esses filtros.</p>
          ) : (
            <GraphView graph={filtered} height={graphHeight} onOpen={onOpen} showAllLabels={labels} />
          )}
          <p className="px-1 pt-2 text-xs text-faint">
            Aqui aparecem também grupos, formas de pagamento e notas. Arraste para mover, use a pinça ou a roda do mouse para aproximar e toque em um nó para
            abrir a nota. Nós tracejados são links para notas que ainda não existem.
          </p>
        </>
      )}
    </section>
  )
}
