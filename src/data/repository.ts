import type { AppData, AppSettings, ID } from '@/domain/types'

export type Collection = 'members' | 'transactions' | 'budgets' | 'settlements' | 'notes' | 'products' | 'shopping'

/**
 * Única porta de entrada e saída dos dados. As telas e a store só conhecem
 * esta interface; para sincronizar na nuvem, basta criar um
 * `supabaseRepository.ts` com os mesmos métodos (um upsert/delete por tabela)
 * e trocar a instância exportada em `src/data/index.ts`.
 */
export interface Repository {
  load(): Promise<AppData | null>
  replaceAll(data: AppData): Promise<void>
  upsert<C extends Collection>(collection: C, item: AppData[C][number]): Promise<void>
  remove(collection: Collection, id: ID): Promise<void>
  saveSettings(settings: AppSettings): Promise<void>
  clear(): Promise<void>
}
