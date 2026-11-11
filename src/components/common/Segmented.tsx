import { cn } from '@/lib/utils'

/** Seletor deslizante: colunas de largura igual, o polegar anda só com translateX. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  label: string
  className?: string
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('relative grid rounded-lg bg-muted p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-md bg-accent ring-1 ring-foreground/10 transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)]"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative ctl-sm truncate rounded-md px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
            o.value === value ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
