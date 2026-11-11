import { CircleCheck, RotateCcw, TriangleAlert } from 'lucide-react'
import { ColorField } from '@/components/common/ColorField'
import { Button } from '@/components/ui/button'
import { CATEGORIES } from '@/domain/categories'
import { contrast, mix } from '@/domain/color'
import { categoryColors, effectiveTheme, isCustomized, PRESETS, THEME_KEYS, type Theme } from '@/domain/theme'
import { cn } from '@/lib/utils'
import { useAppStore, useData } from '@/store/useAppStore'

const sameTheme = (a: Theme, b: Theme) => THEME_KEYS.every(({ key }) => a[key] === b[key])

/** Cores da interface e das categorias, com aviso quando uma combinação fica difícil de ler. */
export function AppearanceSection() {
  const settings = useData().settings
  const setTheme = useAppStore((s) => s.setTheme)
  const setCategoryColor = useAppStore((s) => s.setCategoryColor)
  const resetAppearance = useAppStore((s) => s.resetAppearance)

  const theme = effectiveTheme(settings)
  const categories = categoryColors(settings)

  // as mesmas combinações que a interface usa de fato
  const checks = [
    { label: 'Texto sobre o fundo', ratio: contrast(theme.foreground, theme.background), min: 4.5 },
    { label: 'Texto sobre os cartões', ratio: contrast(theme.foreground, theme.card), min: 4.5 },
    { label: 'Texto secundário sobre os cartões', ratio: contrast(mix(theme.foreground, theme.background, 0.28), theme.card), min: 4.5 },
    { label: 'Destaque (links e aba ativa) sobre o fundo', ratio: contrast(theme.primary, theme.background), min: 3 },
  ]
  const failing = checks.filter((c) => c.ratio < c.min)

  return (
    <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="aparencia">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="aparencia" className="text-base font-semibold">
            Aparência
          </h2>
          <p className="mt-1 max-w-[60ch] text-sm text-muted-foreground">
            Escolha um tema pronto ou monte o seu. As cores valem neste aparelho e entram no backup.
          </p>
        </div>
        <Button variant="secondary" className="gap-2" onClick={resetAppearance} disabled={!isCustomized(settings)}>
          <RotateCcw className="size-4" /> Restaurar cores padrão
        </Button>
      </div>

      <h3 className="eyebrow mt-5 mb-2">temas prontos</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PRESETS.map((p) => {
          const active = sameTheme(theme, p.theme)
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setTheme(p.theme)}
              aria-pressed={active}
              className={cn(
                'press flex items-center gap-3 rounded-xl border p-2.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'border-primary' : 'border-border hover:border-foreground/25',
              )}
            >
              {/* miniatura: fundo, cartão, texto e as duas cores de acento do tema */}
              <span className="flex h-10 w-14 shrink-0 items-end gap-1 rounded-lg p-1.5 ring-1 ring-foreground/15" style={{ background: p.theme.background }}>
                <span className="h-full flex-1 rounded-[3px]" style={{ background: p.theme.card }} />
                <span className="h-3/5 w-1.5 rounded-[2px]" style={{ background: p.theme.primary }} />
                <span className="h-4/5 w-1.5 rounded-[2px]" style={{ background: p.theme.brand }} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="block text-xs text-muted-foreground">{active ? 'Em uso' : 'Aplicar'}</span>
              </span>
            </button>
          )
        })}
      </div>

      <h3 className="eyebrow mt-6 mb-2">cores da interface</h3>
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {THEME_KEYS.map(({ key, label, hint }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <label htmlFor={`tema-${key}`} className="min-w-0">
              <span className="block text-sm font-medium">{label}</span>
              <span className="block truncate text-xs text-muted-foreground">{hint}</span>
            </label>
            <ColorField id={`tema-${key}`} label={label} value={theme[key]} onChange={(hex) => setTheme({ [key]: hex })} />
          </div>
        ))}
      </div>

      <div
        role="status"
        className={cn(
          'mt-4 rounded-xl border px-3.5 py-3 text-sm',
          failing.length ? 'border-warning/60 bg-warning/10' : 'border-border',
        )}
      >
        {failing.length === 0 ? (
          <p className="flex items-center gap-2">
            <CircleCheck className="size-4 shrink-0" style={{ color: 'var(--good)' }} />
            Todas as combinações de texto estão legíveis.
          </p>
        ) : (
          <>
            <p className="flex items-center gap-2 font-medium">
              <TriangleAlert className="size-4 shrink-0" style={{ color: 'var(--warning)' }} />
              {failing.length === 1 ? 'Uma combinação está difícil de ler' : `${failing.length} combinações estão difíceis de ler`}
            </p>
            <ul className="mt-1.5 list-disc pl-9 text-muted-foreground">
              {failing.map((c) => (
                <li key={c.label}>
                  {c.label}: contraste {c.ratio.toFixed(1).replace('.', ',')}:1 (o mínimo recomendado é {String(c.min).replace('.', ',')}:1)
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <h3 className="eyebrow mt-6 mb-2">cores das categorias</h3>
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {CATEGORIES.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3">
            <label htmlFor={`cat-${c.id}`} className="text-sm">
              {c.name}
            </label>
            <ColorField id={`cat-${c.id}`} label={`Cor de ${c.name}`} value={categories[c.id]} onChange={(hex) => setCategoryColor(c.id, hex)} />
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-faint">
        A cor de cada morador fica em Moradores, e a de cada assinatura no botão "Trocar" da própria nota.
      </p>
    </section>
  )
}
