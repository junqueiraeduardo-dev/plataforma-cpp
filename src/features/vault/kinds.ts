import type { NoteKind } from '@/domain/types'

// Na lista e na legenda cada tipo tem uma cor e uma forma; no grafo, assinaturas e
// moradores usam a própria cor, e é a forma que diz o tipo do nó.
export const KIND: Record<NoteKind | 'ghost', { label: string; plural: string; color: string; shape: 'circle' | 'square' | 'diamond' | 'triangle' | 'ring' }> = {
  subscription: { label: 'Assinatura', plural: 'Assinaturas', color: '#3987e5', shape: 'circle' },
  group: { label: 'Grupo', plural: 'Grupos', color: '#d95926', shape: 'square' },
  member: { label: 'Morador', plural: 'Moradores', color: '#199e70', shape: 'diamond' },
  payment: { label: 'Pagamento', plural: 'Formas de pagamento', color: 'var(--muted-foreground)', shape: 'triangle' },
  note: { label: 'Nota', plural: 'Notas', color: 'var(--faint)', shape: 'circle' },
  ghost: { label: 'Ainda não criada', plural: 'Ainda não criadas', color: 'var(--faint)', shape: 'ring' },
}

export const KIND_ORDER: NoteKind[] = ['subscription', 'group', 'member', 'payment', 'note']
