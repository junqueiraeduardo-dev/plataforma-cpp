import { useState } from 'react'
import { CATEGORIES } from '@/domain/categories'
import { readableOn } from '@/domain/color'
import { formatBRL } from '@/domain/money'
import type { CategoryId } from '@/domain/types'
import { cn } from '@/lib/utils'
import { useThemeColors } from '@/store/selectors'

/**
 * Barra segmentada alta: o mês inteiro dividido por categoria.
 * A ordem das categorias é fixa (a cor segue a categoria, nunca a posição no ranking).
 */
export function CategoryBar({ values }: { values: Record<CategoryId, number> }) {
  const [hover, setHover] = useState<CategoryId | null>(null)
  const { categories } = useThemeColors()
  const parts = CATEGORIES.map((c) => ({ ...c, value: values[c.id] })).filter((p) => p.value > 0)
  const total = parts.reduce((s, p) => s + p.value, 0)
  if (total === 0) return null

  const active = parts.find((p) => p.id === hover)
  const summary = parts.map((p) => `${p.name} ${formatBRL(p.value)}`).join(', ')

  return (
    <div>
      <div className="mb-2 flex min-h-5 flex-wrap items-baseline gap-x-2 text-sm" aria-live="polite">
        {active ? (
          <>
            <span className="size-2 shrink-0 rounded-full" style={{ background: active.color }} />
            <span className="num font-semibold">{formatBRL(active.value)}</span>
            <span className="text-muted-foreground">
              {active.name} · {Math.round((active.value / total) * 100)}%
            </span>
          </>
        ) : (
          <span className="text-faint">Toque em uma parte para ver o valor</span>
        )}
      </div>

      <div className="flex h-9 gap-0.5 md:h-7" role="group" aria-label={`Gastos por categoria: ${summary}`}>
        {parts.map((p) => {
          const share = p.value / total
          return (
            <button
              key={p.id}
              type="button"
              aria-label={`${p.name}: ${formatBRL(p.value)}, ${Math.round(share * 100)}%`}
              // marca de gráfico: a largura é o próprio dado; os valores também estão na tabela logo abaixo
              data-chart-mark=""
              onPointerEnter={() => setHover(p.id)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(p.id)}
              onBlur={() => setHover(null)}
              className={cn(
                'flex min-w-1 items-center rounded-[4px] pl-1.5 text-xs font-semibold outline-none transition-opacity duration-150 focus-visible:ring-2 focus-visible:ring-foreground',
                hover && hover !== p.id && 'opacity-45',
              )}
              style={{
                flexGrow: p.value,
                flexBasis: 0,
                background: p.color,
                color: readableOn(categories[p.id]),
              }}
            >
              {/* o rótulo só entra quando cabe com folga */}
              {share >= 0.09 && <span aria-hidden="true">{Math.round(share * 100)}%</span>}
            </button>
          )
        })}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {parts.map((p) => (
          <li key={p.id} className="flex items-center gap-1.5">
            <span className="size-2 rounded-[2px]" style={{ background: p.color }} />
            {p.name}
          </li>
        ))}
      </ul>
    </div>
  )
}
