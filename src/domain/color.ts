/** Utilitários de cor em hexadecimal (#rrggbb). Tudo puro, sem DOM. */

export function normalizeHex(input: string): string | null {
  const s = input.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(s)) return s
  if (/^#[0-9a-f]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`
  if (/^[0-9a-f]{6}$/.test(s)) return `#${s}`
  return null
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex) ?? '#000000'
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** Luminância relativa (WCAG), de 0 a 1. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Razão de contraste WCAG entre duas cores, de 1 a 21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export const INK_DARK = '#0c1612'
export const INK_LIGHT = '#ffffff'

/** Tinta (escura ou clara) que lê melhor sobre a cor dada. */
export function readableOn(bg: string): string {
  return contrast(bg, INK_DARK) >= contrast(bg, INK_LIGHT) ? INK_DARK : INK_LIGHT
}

export function isDark(hex: string): boolean {
  return readableOn(hex) === INK_LIGHT
}

/** Mistura linear em sRGB: t = 0 devolve a, t = 1 devolve b. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t)
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const SWATCHES = [
  '#e50914', '#ff7350', '#f59e0b', '#e3b341', '#84cc16', '#1db954',
  '#14b8a6', '#17bac8', '#3987e5', '#2563eb', '#f08fa8', '#7f9099',
]

/** Cor estável derivada de um texto, para itens que ainda não têm cor própria. */
export function hashColor(text: string): string {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0
  return SWATCHES[h % SWATCHES.length]
}
