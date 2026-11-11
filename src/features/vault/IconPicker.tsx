import { ImageUp, Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { ColorField } from '@/components/common/ColorField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SWATCHES } from '@/domain/color'
import type { Note, SubscriptionProps } from '@/domain/types'
import { titleKey } from '@/domain/wikilinks'
import { cn } from '@/lib/utils'
import { BRANDS, matchBrand } from './brands'
import { GENERIC_ICONS } from './genericIcons'
import { IconTile } from './SubscriptionIcon'
import { fileToIcon, monogram, subscriptionLook, type ResolvedIcon } from './subscriptionIcon'

// marcas mostradas antes de qualquer busca
const POPULAR = ['netflix', 'spotify', 'primevideo', 'youtube', 'hbomax', 'icloud', 'google', 'xbox', 'playstation', 'nintendoswitch', 'microsoftoffice', 'openai', 'crunchyroll', 'deezer', 'duolingo', 'canva', 'adobecreativecloud', 'notion', 'ifood', 'uber', 'nubank', 'twitch', 'discord', 'claude']

export function IconPicker({
  open,
  onOpenChange,
  note,
  onChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  note: Pick<Note, 'title' | 'subscription'>
  onChange: (patch: Pick<SubscriptionProps, 'icon' | 'color' | 'image'>) => void
}) {
  const [query, setQuery] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const sub = note.subscription
  const look = subscriptionLook(note)
  const auto = subscriptionLook({ title: note.title, subscription: sub ? { ...sub, icon: null } : null })
  const suggested = matchBrand(note.title)

  const q = titleKey(query)
  const brands = useMemo(() => {
    if (!q) return POPULAR.map((slug) => BRANDS.find((b) => b.slug === slug)).filter((b) => !!b)
    return BRANDS.filter((b) => titleKey(b.title).includes(q) || b.aliases.some((a) => a.includes(q))).slice(0, 30)
  }, [q])
  const generics = q ? GENERIC_ICONS.filter((g) => titleKey(g.label).includes(q) || g.key.includes(q)) : GENERIC_ICONS

  if (!sub) return null
  const current = sub.icon ?? null
  const setIcon = (icon: string | null) => onChange({ icon, color: sub.color ?? null, image: sub.image ?? null })
  const setColor = (color: string | null) => onChange({ icon: sub.icon ?? null, color, image: sub.image ?? null })
  const upload = async (file: File | undefined) => {
    if (!file) return
    setUploadError(null)
    const result = await fileToIcon(file)
    if (result.ok) onChange({ icon: 'image', color: sub.color ?? null, image: result.dataUrl })
    else setUploadError(result.error)
    if (fileRef.current) fileRef.current.value = ''
  }

  const option = (selected: boolean) =>
    cn(
      'press flex flex-col items-center justify-start gap-1.5 rounded-xl border px-1 py-2 text-center text-xs leading-tight outline-none focus-visible:ring-2 focus-visible:ring-ring',
      selected ? 'border-primary bg-accent text-foreground' : 'border-transparent text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
    )
  const tile = (icon: ResolvedIcon, color: string) => <IconTile icon={icon} color={color} size="md" />

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[34rem]">
        <DialogHeader>
          <DialogTitle>Ícone e cor de {note.title}</DialogTitle>
          <DialogDescription>
            {suggested
              ? `O nome foi reconhecido como ${suggested.title}; o automático usa o logotipo e a cor da marca.`
              : 'Não há logotipo deste serviço na biblioteca. O automático usa um selo com as letras da marca; para o logotipo original, toque em "Enviar imagem".'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
          <IconTile icon={look.icon} color={look.color} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-medium">{note.title}</p>
            <p className="text-xs text-muted-foreground">
              {look.autoIcon ? 'Ícone automático' : look.icon.label} · {look.autoColor ? 'cor automática' : look.color}
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar marca ou ícone" aria-label="Buscar marca ou ícone" className="pl-8" />
        </div>

        {!q && (
          <div className="grid grid-cols-3 gap-1 min-[400px]:grid-cols-4 sm:grid-cols-5">
            <button type="button" className={option(current === null)} aria-pressed={current === null} onClick={() => setIcon(null)}>
              {tile(auto.icon, look.color)}
              Automático
            </button>
            <button type="button" className={option(current === 'letter')} aria-pressed={current === 'letter'} onClick={() => setIcon('letter')}>
              {tile({ kind: 'text', text: monogram(note.title), label: 'Iniciais' }, look.color)}
              Iniciais
            </button>
            {sub.image && (
              <button type="button" className={option(current === 'image')} aria-pressed={current === 'image'} onClick={() => setIcon('image')}>
                {tile({ kind: 'image', src: sub.image, label: 'Imagem própria' }, look.color)}
                Sua imagem
              </button>
            )}
            <button type="button" className={option(false)} onClick={() => fileRef.current?.click()}>
              <span className="inline-flex size-10 items-center justify-center rounded-[10px] border border-dashed border-foreground/30">
                <ImageUp className="size-5" />
              </span>
              Enviar imagem
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              aria-label="Imagem para o ícone"
              onChange={(e) => void upload(e.target.files?.[0])}
            />
          </div>
        )}
        {uploadError && (
          <p role="alert" className="rounded-lg border border-critical/50 bg-critical/10 px-3 py-2 text-sm">
            {uploadError}
          </p>
        )}

        <section>
          <h3 className="eyebrow mb-1.5">{q ? `marcas · ${brands.length}` : 'marcas mais usadas'}</h3>
          {brands.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma marca com "{query}". Envie a imagem do logotipo (botão "Enviar imagem", sem busca) ou use um ícone abaixo.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1 min-[400px]:grid-cols-4 sm:grid-cols-5">
              {brands.map((b) => (
                <button
                  key={b.slug}
                  type="button"
                  className={option(current === `brand:${b.slug}`)}
                  aria-pressed={current === `brand:${b.slug}`}
                  onClick={() => setIcon(`brand:${b.slug}`)}
                >
                  {tile({ kind: 'brand', path: b.path, label: b.title }, sub.color ?? b.hex)}
                  <span className="w-full [overflow-wrap:anywhere]">{b.title}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {generics.length > 0 && (
          <section>
            <h3 className="eyebrow mb-1.5">ícones</h3>
            <div className="grid grid-cols-3 gap-1 min-[400px]:grid-cols-4 sm:grid-cols-5">
              {generics.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  className={option(current === `icon:${g.key}`)}
                  aria-pressed={current === `icon:${g.key}`}
                  onClick={() => setIcon(`icon:${g.key}`)}
                >
                  {tile({ kind: 'generic', d: g.d, label: g.label }, look.color)}
                  <span className="w-full [overflow-wrap:anywhere]">{g.label}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          <h3 className="eyebrow mb-2">cor</h3>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setColor(null)}
              aria-pressed={look.autoColor}
              className={cn(
                'press ctl-sm rounded-lg border px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring',
                look.autoColor ? 'border-primary bg-accent' : 'border-input text-muted-foreground',
              )}
            >
              Automática
            </button>
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Cor ${c}`}
                aria-pressed={!look.autoColor && look.color === c}
                className={cn(
                  'press ctl-icon-sm rounded-full outline-none ring-offset-2 ring-offset-[var(--popover)] focus-visible:ring-2 focus-visible:ring-ring',
                  !look.autoColor && look.color === c && 'ring-2 ring-foreground',
                )}
                style={{ background: c }}
              />
            ))}
            <ColorField id="sub-color" label="Cor personalizada" value={look.color} onChange={setColor} />
          </div>
        </section>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Concluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
