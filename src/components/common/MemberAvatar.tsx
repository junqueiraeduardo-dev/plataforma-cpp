import { readableOn } from '@/domain/color'
import type { Member } from '@/domain/types'
import { cn } from '@/lib/utils'

const SIZES = {
  xs: 'size-5 text-xs',
  sm: 'size-6 text-xs',
  md: 'size-8 text-xs',
  lg: 'size-11 text-base',
  xl: 'size-14 text-xl',
}

export function MemberAvatar({
  member,
  size = 'md',
  className,
}: {
  member: Pick<Member, 'name' | 'color' | 'photo'> | undefined
  size?: keyof typeof SIZES
  className?: string
}) {
  const name = member?.name ?? '?'
  const base = cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold select-none', SIZES[size], className)
  if (member?.photo) {
    return (
      <span title={name} role="img" aria-label={name} className={base} style={{ background: member.color }}>
        <img src={member.photo} alt="" className="size-full object-cover" draggable={false} />
      </span>
    )
  }
  return (
    <span
      title={name}
      aria-label={name}
      className={base}
      style={member ? { background: member.color, color: readableOn(member.color) } : { background: 'var(--faint)', color: 'var(--background)' }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function AvatarStack({ members, size = 'sm' }: { members: (Member | undefined)[]; size?: keyof typeof SIZES }) {
  return (
    <span className="inline-flex">
      {members.map((m, i) => (
        <MemberAvatar
          key={m?.id ?? i}
          member={m}
          size={size}
          className={cn('ring-2 ring-card', i > 0 && '-ml-1.5')}
        />
      ))}
    </span>
  )
}
