import { readableOn } from '@/domain/color'
import type { CategoryId } from '@/domain/types'
import { SubscriptionIcon } from '@/features/vault/SubscriptionIcon'
import { cn } from '@/lib/utils'
import { useThemeColors } from '@/store/selectors'
import { useData } from '@/store/useAppStore'
import { expenseIcon } from './expenseIcons'

const SIZES = {
  sm: { box: 'size-8 rounded-lg', glyph: 'size-4', sub: 'sm' as const },
  md: { box: 'size-10 rounded-[10px]', glyph: 'size-5', sub: 'md' as const },
}

/**
 * Selo de um gasto: o ícone do que foi comprado, na cor da categoria.
 * Cobranças de assinatura usam o próprio logotipo da assinatura.
 */
export function ExpenseIcon({
  expense,
  size = 'sm',
  className,
}: {
  expense: { description: string; category_id: CategoryId; icon?: string | null; note_id?: string }
  size?: keyof typeof SIZES
  className?: string
}) {
  const { categories } = useThemeColors()
  const notes = useData().notes
  const s = SIZES[size]
  const note = expense.note_id ? notes.find((n) => n.id === expense.note_id) : undefined
  if (note) return <SubscriptionIcon note={note} size={s.sub} className={className} />

  const { Icon } = expenseIcon(expense)
  const color = categories[expense.category_id]
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex shrink-0 items-center justify-center ring-1 ring-foreground/10', s.box, className)}
      style={{ background: color, color: readableOn(color) }}
    >
      <Icon className={s.glyph} strokeWidth={2} />
    </span>
  )
}
