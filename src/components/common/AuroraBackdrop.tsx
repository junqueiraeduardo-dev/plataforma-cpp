import { useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import Aurora from '@/components/reactbits/Aurora'
import { useThemeColors } from '@/store/selectors'

let webglSupport: boolean | null = null

function hasWebGL2(): boolean {
  if (webglSupport !== null) return webglSupport
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    webglSupport = !!gl && !gl.isContextLost()
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webglSupport = false
  }
  return webglSupport
}

const STATIC =
  'radial-gradient(120% 90% at 18% 0%, color-mix(in oklab, var(--brand) 55%, transparent), transparent 60%), radial-gradient(90% 80% at 85% 0%, color-mix(in oklab, var(--primary) 28%, transparent), transparent 62%)'

/**
 * Aurora (React Bits) com rede de segurança: sem WebGL, com o contexto perdido
 * ou com "reduzir movimento" ligado, entra um degradê estático da mesma família.
 */
export function AuroraBackdrop({ className }: { className?: string }) {
  const reduced = useReducedMotion()
  const theme = useThemeColors()
  const ref = useRef<HTMLDivElement>(null)
  const [supported, setSupported] = useState(hasWebGL2)
  const live = supported && !reduced

  useEffect(() => {
    const el = ref.current
    if (!el || !live) return
    const onLost = () => setSupported(false)
    // o evento nasce no <canvas>; a fase de captura o entrega aqui
    el.addEventListener('webglcontextlost', onLost, true)
    // alguns ambientes entregam o contexto já perdido, sem disparar o evento
    const check = window.setTimeout(() => {
      const canvas = el.querySelector('canvas')
      const gl = canvas?.getContext('webgl2')
      if (!gl || gl.isContextLost()) setSupported(false)
    }, 400)
    return () => {
      el.removeEventListener('webglcontextlost', onLost, true)
      window.clearTimeout(check)
    }
  }, [live])

  return (
    <div ref={ref} className={className} aria-hidden="true">
      <div className="absolute inset-0" style={{ background: STATIC }} />
      {live && (
        <div className="absolute inset-0 opacity-70">
          <Aurora
            colorStops={[theme.brand, theme.primary, theme.brand]}
            amplitude={0.9}
            speed={0.5}
            height={0.5}
            glow={0.35}
            mouseInteraction={false}
          />
        </div>
      )}
    </div>
  )
}
