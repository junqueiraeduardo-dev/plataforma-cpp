export type ID = string
/** Data local no formato YYYY-MM-DD. */
export type ISODate = string

export type CategoryId =
  | 'moradia'
  | 'mercado'
  | 'contas'
  | 'transporte'
  | 'lazer'
  | 'saude'
  | 'assinaturas'
  | 'outros'

export interface Category {
  id: CategoryId
  name: string
  /** Cor da série nos gráficos (paleta validada para o fundo escuro). */
  color: string
}

export interface Member {
  id: ID
  household_id: ID
  name: string
  color: string
  /** Foto do perfil enviada pelo usuário (data URL pequena, 128 px). */
  photo?: string | null
  created_at: string
}

export type SplitMode = 'equal' | 'percent' | 'exact'

/**
 * equal:   shares = { memberId: 1 } para cada participante
 * percent: shares = { memberId: percentual } somando 100
 * exact:   shares = { memberId: centavos } somando o valor do gasto
 */
export interface Split {
  mode: SplitMode
  shares: Record<ID, number>
}

export interface Transaction {
  id: ID
  household_id: ID
  date: ISODate
  description: string
  /** Centavos, sempre positivo. */
  amount: number
  category_id: CategoryId
  payer_id: ID
  split: Split
  /** Ícone escolhido à mão; ausente = automático pela descrição. */
  icon?: string | null
  created_at: string
}

export interface Budget {
  id: ID
  household_id: ID
  category_id: CategoryId
  /** Limite mensal em centavos. */
  limit: number
}

export interface Settlement {
  id: ID
  household_id: ID
  date: ISODate
  from_id: ID
  to_id: ID
  amount: number
  created_at: string
}

export type NoteKind = 'subscription' | 'group' | 'member' | 'payment' | 'note'
export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled'

export interface SubscriptionProps {
  /** Preço por ciclo, em centavos. */
  price: number
  cycle: BillingCycle
  /** Data da primeira cobrança; define o dia das renovações. */
  start_date: ISODate
  /** Preenchida ao pausar ou cancelar: cobranças param a partir desta data. */
  end_date: ISODate | null
  status: SubscriptionStatus
  payer_id: ID
  shared_with: ID[]
  /** Agrupador (ex.: Streaming). Vira ligação no grafo. */
  group: string
  payment_method: string
  /**
   * Ícone: ausente = automático (logotipo pelo nome, senão ícone do grupo),
   * "brand:<slug>", "icon:<chave>" ou "letter".
   */
  icon?: string | null
  /** Cor própria em #rrggbb; ausente = cor da marca ou derivada do nome. */
  color?: string | null
  /** Imagem enviada pelo usuário (data URL pequena), usada quando icon = "image". */
  image?: string | null
  /** Posição na ordem escolhida à mão; ausente = ainda não ordenada. */
  sort?: number | null
}

export interface Note {
  id: ID
  household_id: ID
  title: string
  kind: NoteKind
  body: string
  subscription: SubscriptionProps | null
  created_at: string
  updated_at: string
}

export type MarketSection =
  | 'hortifruti'
  | 'padaria'
  | 'laticinios'
  | 'carnes'
  | 'mercearia'
  | 'bebidas'
  | 'congelados'
  | 'limpeza'
  | 'higiene'
  | 'casa'
  | 'outros'

/**
 * Memória do que a casa já escreveu na lista: alimenta as sugestões e lembra
 * em que seção cada item fica.
 */
export interface Product {
  id: ID
  household_id: ID
  name: string
  section: MarketSection
  /** Quantas vezes já entrou na lista. */
  uses?: number
  created_at: string
}

/** Item da lista de compras. */
export interface ShoppingItem {
  id: ID
  household_id: ID
  /** Chave de agrupamento: itens com a mesma chave somam quantidade em vez de duplicar. */
  product_key: string
  name: string
  section: MarketSection
  quantity: number
  /** Medida ou observação escrita junto: "2 kg", "500 g". */
  detail?: string | null
  checked: boolean
  created_at: string
}

export type VaultGroupBy = 'group' | 'payer' | 'none'
export type VaultSortBy = 'manual' | 'price' | 'next' | 'name'

export interface AppSettings {
  /** Como a galeria de assinaturas agrupa e ordena. */
  vault?: { group_by?: VaultGroupBy; sort_by?: VaultSortBy }
  /** Cores da interface que o usuário alterou (#rrggbb); o que faltar usa o padrão. */
  theme?: Partial<Record<'background' | 'card' | 'foreground' | 'primary' | 'brand', string>>
  category_colors?: Partial<Record<CategoryId, string>>
}

export interface AppData {
  version: 1
  household: { id: ID; name: string }
  settings?: AppSettings
  members: Member[]
  transactions: Transaction[]
  budgets: Budget[]
  settlements: Settlement[]
  notes: Note[]
  products: Product[]
  shopping: ShoppingItem[]
}

/** Gasto já normalizado: transação lançada ou cobrança de assinatura. */
export interface Expense {
  id: string
  date: ISODate
  description: string
  amount: number
  category_id: CategoryId
  payer_id: ID
  /** Parte de cada morador, em centavos; soma = amount. */
  shares: Record<ID, number>
  source: 'transaction' | 'subscription'
  note_id?: ID
  icon?: string | null
}
