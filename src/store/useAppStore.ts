import { create } from 'zustand'
import { repository } from '@/data'
import type { Collection } from '@/data/repository'
import { buildSeed, emptyData, MEMBER_COLORS, uid } from '@/data/seed'
import { today } from '@/domain/dates'
import { itemKey } from '@/domain/shopping'
import type {
  AppData,
  AppSettings,
  Budget,
  CategoryId,
  ID,
  MarketSection,
  Member,
  Note,
  NoteKind,
  Product,
  Settlement,
  ShoppingItem,
  SubscriptionProps,
  Transaction,
} from '@/domain/types'
import { titleKey } from '@/domain/wikilinks'

export type TransactionInput = Omit<Transaction, 'id' | 'household_id' | 'created_at'>

interface AppState {
  status: 'loading' | 'ready'
  data: AppData
  /** Última falha ao gravar; a interface avisa o usuário. */
  persistError: string | null

  hydrate: () => Promise<void>

  addTransaction: (input: TransactionInput) => Transaction
  updateTransaction: (id: ID, input: TransactionInput) => void
  deleteTransaction: (id: ID) => void
  restoreTransaction: (t: Transaction) => void

  setBudget: (category_id: CategoryId, limit: number) => void

  addMember: (name: string) => Member
  renameMember: (id: ID, name: string) => void
  setMemberColor: (id: ID, color: string) => void
  /** Foto do perfil (data URL já reduzida) ou null para voltar à inicial. */
  setMemberPhoto: (id: ID, photo: string | null) => void
  /** Devolve o motivo quando o morador ainda está vinculado a algum lançamento. */
  removeMember: (id: ID) => string | null

  addSettlement: (input: Pick<Settlement, 'from_id' | 'to_id' | 'amount'>) => Settlement
  deleteSettlement: (id: ID) => void

  createNote: (title: string, kind: NoteKind, subscription?: SubscriptionProps) => Note
  updateNote: (id: ID, patch: Partial<Pick<Note, 'title' | 'body' | 'kind' | 'subscription'>>) => void
  deleteNote: (id: ID) => void
  restoreNote: (note: Note) => void

  renameHousehold: (name: string) => void

  /** Troca cores da interface; passar o tema inteiro aplica um tema pronto. */
  setTheme: (patch: NonNullable<AppSettings['theme']>) => void
  setCategoryColor: (category_id: CategoryId, color: string) => void
  resetAppearance: () => void

  setVaultPrefs: (patch: NonNullable<AppSettings['vault']>) => void
  /** Grava a ordem manual das assinaturas: a posição no vetor vira a posição na galeria. */
  setSubscriptionOrder: (noteIds: ID[]) => void

  /** Põe na lista o que foi escrito; item que já está lá soma a quantidade. */
  addItems: (items: { name: string; quantity: number; detail: string | null; section: MarketSection }[]) => void
  setQuantity: (itemId: ID, quantity: number) => void
  toggleItem: (itemId: ID) => void
  renameItem: (itemId: ID, name: string) => void
  /** Troca a seção do item e lembra a escolha para as próximas vezes. */
  setItemSection: (itemId: ID, section: MarketSection) => void
  removeItem: (itemId: ID) => void
  restoreItem: (item: ShoppingItem) => void
  /** Tira da lista o que já foi para o carrinho; devolve os itens removidos. */
  clearChecked: () => ShoppingItem[]
  /** Esquece uma sugestão da casa. */
  removeProduct: (id: ID) => void
  restoreProduct: (product: Product) => void

  importData: (data: AppData) => void
  resetDemo: () => void
  clearAll: () => void
}

export const useAppStore = create<AppState>((set, get) => {
  const fail = (error: unknown) => {
    const quota = error instanceof DOMException && error.name === 'QuotaExceededError'
    set({
      persistError: quota
        ? 'O armazenamento do navegador está cheio. Exporte um backup em Ajustes.'
        : 'Não foi possível salvar no navegador. Exporte um backup em Ajustes para não perder dados.',
    })
  }
  const persist = (op: Promise<void>) => {
    op.then(() => {
      if (get().persistError) set({ persistError: null })
    }).catch(fail)
  }
  const upsert = <C extends Collection>(collection: C, item: AppData[C][number]) => {
    const list = get().data[collection] as { id: ID }[]
    const exists = list.some((x) => x.id === item.id)
    const next = exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]
    set({ data: { ...get().data, [collection]: next } })
    persist(repository.upsert(collection, item))
  }
  const remove = (collection: Collection, id: ID) => {
    const list = get().data[collection] as { id: ID }[]
    set({ data: { ...get().data, [collection]: list.filter((x) => x.id !== id) } })
    persist(repository.remove(collection, id))
  }
  const replace = (data: AppData) => {
    set({ data })
    persist(repository.replaceAll(data))
  }
  const hid = () => get().data.household.id
  /** Guarda (ou atualiza) um item na memória de sugestões da casa. */
  const remember = (name: string, section: MarketSection, countUse: boolean) => {
    const key = titleKey(name)
    const known = get().data.products.find((p) => titleKey(p.name) === key)
    if (known) upsert('products', { ...known, section, uses: (known.uses ?? 0) + (countUse ? 1 : 0) })
    else upsert('products', { id: uid(), household_id: hid(), name, section, uses: countUse ? 1 : 0, created_at: new Date().toISOString() })
  }
  const saveSettings = (settings: AppSettings) => {
    set({ data: { ...get().data, settings } })
    persist(repository.saveSettings(settings))
  }

  return {
    status: 'loading',
    data: emptyData(),
    persistError: null,

    hydrate: async () => {
      const stored = await repository.load()
      if (stored) {
        set({ data: stored, status: 'ready' })
        return
      }
      const seed = buildSeed(today())
      set({ data: seed, status: 'ready' })
      persist(repository.replaceAll(seed))
    },

    addTransaction: (input) => {
      const t: Transaction = { ...input, id: uid(), household_id: hid(), created_at: new Date().toISOString() }
      upsert('transactions', t)
      return t
    },
    updateTransaction: (id, input) => {
      const current = get().data.transactions.find((t) => t.id === id)
      if (current) upsert('transactions', { ...current, ...input })
    },
    deleteTransaction: (id) => remove('transactions', id),
    restoreTransaction: (t) => upsert('transactions', t),

    setBudget: (category_id, limit) => {
      const current = get().data.budgets.find((b) => b.category_id === category_id)
      const budget: Budget = current
        ? { ...current, limit }
        : { id: uid(), household_id: hid(), category_id, limit }
      upsert('budgets', budget)
    },

    addMember: (name) => {
      const used = new Set(get().data.members.map((m) => m.color))
      const color = MEMBER_COLORS.find((c) => !used.has(c)) ?? MEMBER_COLORS[get().data.members.length % MEMBER_COLORS.length]
      const member: Member = {
        id: uid(),
        household_id: hid(),
        name: name.trim(),
        color,
        created_at: new Date().toISOString(),
      }
      upsert('members', member)
      return member
    },
    renameMember: (id, name) => {
      const { members, notes } = get().data
      const current = members.find((m) => m.id === id)
      if (!current) return
      upsert('members', { ...current, name: name.trim() })
      // a nota do morador acompanha o nome, para os vínculos do grafo não quebrarem
      const own = notes.find((n) => n.kind === 'member' && titleKey(n.title) === titleKey(current.name))
      if (own) get().updateNote(own.id, { title: name.trim() })
    },
    setMemberColor: (id, color) => {
      const current = get().data.members.find((m) => m.id === id)
      if (current) upsert('members', { ...current, color })
    },
    setMemberPhoto: (id, photo) => {
      const current = get().data.members.find((m) => m.id === id)
      if (current) upsert('members', { ...current, photo })
    },
    removeMember: (id) => {
      const { transactions, settlements, notes } = get().data
      const inTransactions = transactions.some((t) => t.payer_id === id || id in t.split.shares)
      const inSettlements = settlements.some((s) => s.from_id === id || s.to_id === id)
      const inSubs = notes.some((n) => n.subscription && (n.subscription.payer_id === id || n.subscription.shared_with.includes(id)))
      if (inTransactions || inSettlements || inSubs) {
        return 'Este morador ainda aparece em gastos, acertos ou assinaturas. Remova ou reatribua esses lançamentos antes.'
      }
      remove('members', id)
      return null
    },

    addSettlement: (input) => {
      const s: Settlement = {
        ...input,
        id: uid(),
        household_id: hid(),
        date: today(),
        created_at: new Date().toISOString(),
      }
      upsert('settlements', s)
      return s
    },
    deleteSettlement: (id) => remove('settlements', id),

    createNote: (title, kind, subscription) => {
      const existing = new Set(get().data.notes.map((n) => titleKey(n.title)))
      let unique = title.trim() || 'Sem título'
      for (let i = 2; existing.has(titleKey(unique)); i++) unique = `${title.trim() || 'Sem título'} ${i}`
      const now = new Date().toISOString()
      const note: Note = {
        id: uid(),
        household_id: hid(),
        title: unique,
        kind,
        body: '',
        subscription: subscription ?? null,
        created_at: now,
        updated_at: now,
      }
      upsert('notes', note)
      return note
    },
    updateNote: (id, patch) => {
      const { notes } = get().data
      const current = notes.find((n) => n.id === id)
      if (!current) return
      const next: Note = { ...current, ...patch, updated_at: new Date().toISOString() }
      if (patch.title !== undefined && titleKey(patch.title) !== titleKey(current.title)) {
        const oldKey = titleKey(current.title)
        const newTitle = patch.title
        // renomear atualiza os [[links]] das outras notas, como no Obsidian
        for (const other of notes) {
          if (other.id === id) continue
          const body = other.body.replace(/\[\[([^[\]|\n]+?)(\|[^[\]\n]+?)?\]\]/g, (match, target: string, alias?: string) =>
            titleKey(target) === oldKey ? `[[${newTitle}${alias ?? ''}]]` : match,
          )
          let subscription = other.subscription
          if (subscription) {
            if (titleKey(subscription.group) === oldKey) subscription = { ...subscription, group: newTitle }
            if (titleKey(subscription.payment_method) === oldKey) subscription = { ...subscription, payment_method: newTitle }
          }
          if (body !== other.body || subscription !== other.subscription) {
            upsert('notes', { ...other, body, subscription, updated_at: next.updated_at })
          }
        }
      }
      upsert('notes', next)
    },
    deleteNote: (id) => remove('notes', id),
    restoreNote: (note) => upsert('notes', note),

    renameHousehold: (name) => replace({ ...get().data, household: { ...get().data.household, name: name.trim() } }),
    setTheme: (patch) => {
      const settings = get().data.settings ?? {}
      saveSettings({ ...settings, theme: { ...settings.theme, ...patch } })
    },
    setCategoryColor: (category_id, color) => {
      const settings = get().data.settings ?? {}
      saveSettings({ ...settings, category_colors: { ...settings.category_colors, [category_id]: color } })
    },
    // restaurar as cores não mexe na organização da galeria
    resetAppearance: () => saveSettings({ vault: get().data.settings?.vault }),

    setVaultPrefs: (patch) => {
      const settings = get().data.settings ?? {}
      saveSettings({ ...settings, vault: { ...settings.vault, ...patch } })
    },
    setSubscriptionOrder: (noteIds) => {
      const byId = new Map(get().data.notes.map((n) => [n.id, n]))
      noteIds.forEach((id, index) => {
        const note = byId.get(id)
        if (note?.subscription && note.subscription.sort !== index) {
          upsert('notes', { ...note, subscription: { ...note.subscription, sort: index } })
        }
      })
    },

    addItems: (items) => {
      for (const entry of items) {
        const key = itemKey(entry.name, entry.detail)
        const existing = get().data.shopping.find((i) => i.product_key === key)
        if (existing) {
          upsert('shopping', { ...existing, quantity: Math.min(999, existing.quantity + entry.quantity), checked: false })
        } else {
          upsert('shopping', {
            id: uid(),
            household_id: hid(),
            product_key: key,
            name: entry.name,
            section: entry.section,
            quantity: entry.quantity,
            detail: entry.detail,
            checked: false,
            created_at: new Date().toISOString(),
          })
        }
        remember(entry.name, entry.section, true)
      }
    },
    setQuantity: (itemId, quantity) => {
      const item = get().data.shopping.find((i) => i.id === itemId)
      if (!item) return
      if (quantity < 1) remove('shopping', itemId)
      else upsert('shopping', { ...item, quantity: Math.min(999, Math.round(quantity)) })
    },
    toggleItem: (itemId) => {
      const item = get().data.shopping.find((i) => i.id === itemId)
      if (item) upsert('shopping', { ...item, checked: !item.checked })
    },
    renameItem: (itemId, name) => {
      const clean = name.replace(/\s+/g, ' ').trim().slice(0, 60)
      const item = get().data.shopping.find((i) => i.id === itemId)
      if (!item || !clean || clean === item.name) return
      const key = itemKey(clean, item.detail)
      const twin = get().data.shopping.find((i) => i.id !== itemId && i.product_key === key)
      if (twin) {
        // já existe um item com esse nome: junta os dois
        upsert('shopping', { ...twin, quantity: Math.min(999, twin.quantity + item.quantity), checked: twin.checked && item.checked })
        remove('shopping', itemId)
      } else {
        upsert('shopping', { ...item, name: clean, product_key: key })
      }
      remember(clean, item.section, false)
    },
    setItemSection: (itemId, section) => {
      const item = get().data.shopping.find((i) => i.id === itemId)
      if (!item || item.section === section) return
      upsert('shopping', { ...item, section })
      remember(item.name, section, false)
    },
    removeItem: (itemId) => remove('shopping', itemId),
    restoreItem: (item) => upsert('shopping', item),
    clearChecked: () => {
      const done = get().data.shopping.filter((i) => i.checked)
      for (const item of done) remove('shopping', item.id)
      return done
    },
    removeProduct: (id) => remove('products', id),
    restoreProduct: (product) => upsert('products', product),

    importData: (data) => replace(data),
    // as cores escolhidas são do usuário, não dos dados: sobrevivem a restaurar e a apagar
    resetDemo: () => replace({ ...buildSeed(today()), settings: get().data.settings }),
    clearAll: () => replace({ ...emptyData(get().data.household.name), settings: get().data.settings }),
  }
})

/** Atalho para ler só os dados. */
export const useData = () => useAppStore((s) => s.data)
