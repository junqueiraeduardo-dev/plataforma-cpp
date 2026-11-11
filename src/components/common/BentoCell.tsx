import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import type { CSSProperties, PointerEvent, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Célula do painel. Entra em cascata e inclina de leve na direção do ponteiro,
 * de modo que a profundidade vem do movimento e não de sombras ou brilhos.
 */
export function BentoCell({
  children,
  className,
  style,
  index = 0,
  tilt = true,
  as = 'section',
  label,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
  index?: number
  tilt?: boolean
  as?: 'section' | 'div'
  label?: string
}) {
  const reduced = useReducedMotion()
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const rotateX = useSpring(rx, { stiffness: 250, damping: 28 })
  const rotateY = useSpring(ry, { stiffness: 250, damping: 28 })
  const active = tilt && !reduced

  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (!active || e.pointerType !== 'mouse') return
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2
    ry.set(((e.clientX - rect.left - cx) / cx) * 0.9)
    rx.set(-((e.clientY - rect.top - cy) / cy) * 0.9)
  }
  const onLeave = () => {
    rx.set(0)
    ry.set(0)
  }

  const Component = as === 'section' ? motion.section : motion.div
  return (
    <Component
      aria-label={label}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.04 + index * 0.05, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={cn(
        'relative flex min-w-0 flex-col rounded-2xl border border-border bg-card p-5 transition-colors lg:p-6 duration-200 hover:border-foreground/15',
        className,
      )}
      style={{ rotateX, rotateY, transformPerspective: 1000, ...style }}
    >
      {children}
    </Component>
  )
}
