import type { ReactNode } from 'react'

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-foreground/15 px-6 py-10">
      <p className="text-base font-medium">{title}</p>
      {children && <p className="max-w-[52ch] text-sm text-muted-foreground">{children}</p>}
      {action}
    </div>
  )
}
