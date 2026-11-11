import { animate, useReducedMotion } from 'motion/react'
import { useLayoutEffect, useRef } from 'react'

/**
 * Número que desliza do valor anterior até o novo. O texto final é sempre
 * escrito pelo React, então o valor aparece mesmo se a animação for
 * interrompida (troca rápida de mês, aba em segundo plano, movimento reduzido).
 */
export function AnimatedNumber({
  value,
  format,
  duration = 0.7,
  className,
}: {
  value: number
  format: (value: number) => string
  duration?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  // o que está na tela agora: ponto de partida da próxima animação
  const shown = useRef(0)
  const formatRef = useRef(format)
  formatRef.current = format
  const reduced = useReducedMotion()

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const from = shown.current
    if (reduced || from === value || document.hidden) {
      shown.current = value
      el.textContent = formatRef.current(value)
      return
    }
    el.textContent = formatRef.current(from)
    const controls = animate(from, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        shown.current = v
        el.textContent = formatRef.current(Math.round(v))
      },
      onComplete: () => {
        shown.current = value
        el.textContent = formatRef.current(value)
      },
    })
    return () => controls.stop()
  }, [value, duration, reduced])

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  )
}
