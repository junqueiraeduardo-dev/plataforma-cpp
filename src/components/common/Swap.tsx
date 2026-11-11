import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * Troca de conteúdo com entrada suave: quando `id` muda (outro mês, outro
 * filtro), o bloco novo entra deslizando na direção da navegação.
 * Só anima opacidade e transformação.
 */
export function Swap({
  id,
  dir = 0,
  delay = 0,
  className,
  children,
}: {
  id: string
  /** -1 = voltando (entra pela esquerda), 1 = avançando (entra pela direita), 0 = só aparece. */
  dir?: number
  delay?: number
  className?: string
  children: ReactNode
}) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      key={id}
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, x: dir * 20, y: dir === 0 ? 6 : 0 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.36, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
