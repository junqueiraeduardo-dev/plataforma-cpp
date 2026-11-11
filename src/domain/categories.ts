import type { Category, CategoryId } from './types'

// Ordem fixa: é ela que garante a separação entre cores vizinhas na paleta padrão.
// A cor é uma variável CSS, porque o usuário pode trocá-la em Ajustes
// (valores padrão em src/domain/theme.ts).
export const CATEGORIES: Category[] = [
  { id: 'moradia', name: 'Moradia', color: 'var(--cat-moradia)' },
  { id: 'mercado', name: 'Mercado', color: 'var(--cat-mercado)' },
  { id: 'contas', name: 'Contas da casa', color: 'var(--cat-contas)' },
  { id: 'transporte', name: 'Transporte', color: 'var(--cat-transporte)' },
  { id: 'lazer', name: 'Lazer', color: 'var(--cat-lazer)' },
  { id: 'saude', name: 'Saúde', color: 'var(--cat-saude)' },
  { id: 'assinaturas', name: 'Assinaturas', color: 'var(--cat-assinaturas)' },
  { id: 'outros', name: 'Outros', color: 'var(--cat-outros)' },
]

const byId = new Map(CATEGORIES.map((c) => [c.id, c]))

export function category(id: CategoryId): Category {
  return byId.get(id) ?? CATEGORIES[CATEGORIES.length - 1]
}
