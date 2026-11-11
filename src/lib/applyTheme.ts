import { themeIsDark, themeVars } from '@/domain/theme'
import type { AppSettings } from '@/domain/types'

/** Aplica o tema no documento. Estilo inline na raiz vence qualquer folha de estilo do ambiente. */
export function applyTheme(settings: AppSettings | undefined) {
  const root = document.documentElement
  for (const [name, value] of Object.entries(themeVars(settings))) root.style.setProperty(name, value)
  const dark = themeIsDark(settings)
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
}
