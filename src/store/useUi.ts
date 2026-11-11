import { create } from 'zustand'
import type { CategoryId, ID, ISODate, Transaction } from '@/domain/types'

export interface TransactionPrefill {
  description?: string
  category_id?: CategoryId
  /** Centavos. */
  amount?: number
  date?: ISODate
  payer_id?: ID
  /** Tipo de gasto escolhido à mão (chave do ícone). */
  icon?: string | null
}

interface UiState {
  /** null = fechado; { editing: null } = novo gasto. */
  transactionDialog: { editing: Transaction | null; prefill?: TransactionPrefill } | null
  openNewTransaction: (prefill?: TransactionPrefill) => void
  openEditTransaction: (t: Transaction) => void
  closeTransactionDialog: () => void
}

export const useUi = create<UiState>((set) => ({
  transactionDialog: null,
  openNewTransaction: (prefill) => set({ transactionDialog: { editing: null, prefill } }),
  openEditTransaction: (t) => set({ transactionDialog: { editing: t } }),
  closeTransactionDialog: () => set({ transactionDialog: null }),
}))
