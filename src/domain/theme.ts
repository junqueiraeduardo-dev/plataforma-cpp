import { CATEGORIES } from './categories'
import { isDark, normalizeHex, readableOn } from './color'
import type { AppSettings, CategoryId } from './types'

/** As cinco cores que o usuário escolhe; todo o resto da interface deriva delas. */
export interface Theme {
  background: string
  card: string
  foreground: string
  primary: string
  brand: string
}

export const THEME_KEYS: { key: keyof Theme; label: string; hint: string }[] = [
  { key: 'background', label: 'Fundo', hint: 'O plano de fundo de todas as telas' },
  { key: 'card', label: 'Cartões', hint: 'Painéis, listas e janelas' },
  { key: 'foreground', label: 'Texto', hint: 'Textos, ícones e linhas' },
  { key: 'primary', label: 'Destaque', hint: 'Botões principais, links e seleção' },
  { key: 'brand', label: 'Marca', hint: 'Blocos coloridos e barras de progresso' },
]

export const DEFAULT_THEME: Theme = {
  background: '#08161c',
  card: '#0f2028',
  foreground: '#ecf6f6',
  primary: '#d4ee40',
  brand: '#26c0cf',
}

export const PRESETS: { id: string; name: string; theme: Theme }[] = [
  { id: 'petroleo', name: 'Petróleo', theme: DEFAULT_THEME },
  { id: 'grafite', name: 'Grafite', theme: { background: '#141416', card: '#1e1e22', foreground: '#f3f1ea', primary: '#ff8a4c', brand: '#e0b256' } },
  { id: 'floresta', name: 'Floresta', theme: { background: '#0c1811', card: '#14241a', foreground: '#eef6ee', primary: '#ffc928', brand: '#3fbf7f' } },
  { id: 'noite', name: 'Noite', theme: { background: '#090d18', card: '#121a2b', foreground: '#eaf0fb', primary: '#7cc4ff', brand: '#ff7350' } },
  { id: 'papel', name: 'Papel', theme: { background: '#f5f1e6', card: '#fffdf8', foreground: '#1c2a2d', primary: '#0b6b5a', brand: '#c8340a' } },
  { id: 'claro', name: 'Claro', theme: { background: '#eef4f6', card: '#ffffff', foreground: '#10222b', primary: '#005f78', brand: '#0a8f6b' } },
]

export const DEFAULT_CATEGORY_COLORS: Record<CategoryId, string> = {
  moradia: '#3987e5',
  mercado: '#d95926',
  contas: '#199e70',
  transporte: '#c98500',
  lazer: '#d55181',
  saude: '#008300',
  assinaturas: '#e66767',
  outros: '#7f9099',
}

export function effectiveTheme(settings: AppSettings | undefined): Theme {
  const out = { ...DEFAULT_THEME }
  for (const { key } of THEME_KEYS) {
    const value = normalizeHex(settings?.theme?.[key] ?? '')
    if (value) out[key] = value
  }
  return out
}

export function categoryColors(settings: AppSettings | undefined): Record<CategoryId, string> {
  const out = { ...DEFAULT_CATEGORY_COLORS }
  for (const c of CATEGORIES) {
    const value = normalizeHex(settings?.category_colors?.[c.id] ?? '')
    if (value) out[c.id] = value
  }
  return out
}

/** Variáveis CSS que materializam o tema; as demais são derivadas no CSS com color-mix. */
export function themeVars(settings: AppSettings | undefined): Record<string, string> {
  const theme = effectiveTheme(settings)
  const vars: Record<string, string> = {
    '--background': theme.background,
    '--card': theme.card,
    '--foreground': theme.foreground,
    '--primary': theme.primary,
    '--primary-foreground': readableOn(theme.primary),
    '--brand': theme.brand,
  }
  const colors = categoryColors(settings)
  for (const c of CATEGORIES) vars[`--cat-${c.id}`] = colors[c.id]
  return vars
}

export function themeIsDark(settings: AppSettings | undefined): boolean {
  return isDark(effectiveTheme(settings).background)
}

export function isCustomized(settings: AppSettings | undefined): boolean {
  return Object.keys(settings?.theme ?? {}).length > 0 || Object.keys(settings?.category_colors ?? {}).length > 0
}
