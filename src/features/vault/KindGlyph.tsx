import type { NoteKind } from '@/domain/types'
import { KIND } from './kinds'

export function KindGlyph({ kind, size = 10 }: { kind: NoteKind | 'ghost'; size?: number }) {
  const { color, shape } = KIND[kind]
  const common = { width: size, height: size, viewBox: '0 0 10 10', 'aria-hidden': true as const, className: 'shrink-0' }
  if (shape === 'square') return <svg {...common}><rect x="1" y="1" width="8" height="8" rx="1.5" fill={color} /></svg>
  if (shape === 'diamond') return <svg {...common}><path d="M5 0.5 9.5 5 5 9.5 0.5 5Z" fill={color} /></svg>
  if (shape === 'triangle') return <svg {...common}><path d="M5 1 9.5 9H0.5Z" fill={color} /></svg>
  if (shape === 'ring') return <svg {...common}><circle cx="5" cy="5" r="3.6" fill="none" stroke={color} strokeWidth="1.3" strokeDasharray="2 1.4" /></svg>
  return <svg {...common}><circle cx="5" cy="5" r={kind === 'note' ? 3 : 4.2} fill={color} /></svg>
}
