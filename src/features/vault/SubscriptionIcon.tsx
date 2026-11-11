import { readableOn } from '@/domain/color'
import type { Note } from '@/domain/types'
import { cn } from '@/lib/utils'
import { subscriptionLook, textScale, type ResolvedIcon } from './subscriptionIcon'

const SIZES = {
  xs: { box: 'size-5 rounded-[5px]', px: 20 },
  sm: { box: 'size-8 rounded-lg', px: 32 },
  md: { box: 'size-10 rounded-[10px]', px: 40 },
  lg: { box: 'size-12 rounded-xl', px: 48 },
}

/** Selo colorido de uma assinatura: logotipo da marca, imagem enviada, ícone escolhido ou iniciais. */
export function SubscriptionIcon({
  note,
  size = 'md',
  className,
}: {
  note: Pick<Note, 'title' | 'subscription'>
  size?: keyof typeof SIZES
  className?: string
}) {
  const look = subscriptionLook(note)
  return <IconTile icon={look.icon} color={look.color} size={size} className={className} />
}

export function IconTile({
  icon,
  color,
  size = 'md',
  className,
}: {
  icon: ResolvedIcon
  color: string
  size?: keyof typeof SIZES
  className?: string
}) {
  const s = SIZES[size]
  const base = cn('inline-flex shrink-0 items-center justify-center overflow-hidden ring-1 ring-foreground/10', s.box, className)

  if (icon.kind === 'image') {
    return (
      <span aria-hidden="true" className={base}>
        <img src={icon.src} alt="" className="size-full object-cover" draggable={false} />
      </span>
    )
  }
  // no selo menor só cabe a primeira letra
  const text = icon.kind === 'text' ? (size === 'xs' ? [...icon.text][0] : icon.text) : ''
  const glyph = Math.round(s.px * 0.56)
  return (
    <span aria-hidden="true" className={base} style={{ background: color, color: readableOn(color) }}>
      {icon.kind === 'text' ? (
        <span className="leading-none font-bold tracking-[-0.02em]" style={{ fontSize: s.px * textScale(text) }}>
          {text}
        </span>
      ) : (
        <svg width={glyph} height={glyph} viewBox="0 0 24 24">
          {icon.kind === 'brand' ? (
            <path d={icon.path} fill="currentColor" />
          ) : (
            <path d={icon.d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      )}
    </span>
  )
}
