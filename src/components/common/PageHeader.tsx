import type { ReactNode } from 'react'
import BlurText from '@/components/reactbits/BlurText'

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-8">
      <div className="min-w-0">
        <h1 className="sr-only">{title}</h1>
        <div aria-hidden="true">
          <BlurText
            key={title}
            text={title}
            animateBy="words"
            direction="bottom"
            trigger="load"
            delay={60}
            className="text-[1.75rem] font-semibold tracking-[-0.025em] leading-[1.1] sm:text-[2rem]"
          />
        </div>
        {description && <p className="mt-1.5 max-w-[60ch] text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
