import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useRef } from 'react'
import { monthKey, monthLabel, shiftMonth, today, type MonthKey } from '@/domain/dates'

export function MonthSwitcher({ month, onChange }: { month: MonthKey; onChange: (m: MonthKey) => void }) {
  const current = monthKey(today())
  const atEnd = month >= current
  const reduced = useReducedMotion()
  // direção da última troca, para o nome do mês deslizar para o lado certo
  const last = useRef(month)
  const dir = useRef(0)
  if (last.current !== month) {
    dir.current = month > last.current ? 1 : -1
    last.current = month
  }
  const button =
    'press inline-flex ctl-icon-sm items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-35 disabled:hover:text-muted-foreground'
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1">
      <button type="button" className={button} onClick={() => onChange(shiftMonth(month, -1))} aria-label="Mês anterior">
        <ChevronLeft className="size-4" />
      </button>
      <span className="relative block h-5 min-w-[8.5rem] flex-1 overflow-hidden text-center text-sm font-medium" aria-live="polite">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={month}
            className="absolute inset-0 block first-letter:uppercase"
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: dir.current * 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: dir.current * -18 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            {monthLabel(month)}
          </motion.span>
        </AnimatePresence>
      </span>
      <button type="button" className={button} onClick={() => onChange(shiftMonth(month, 1))} disabled={atEnd} aria-label="Próximo mês">
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}
