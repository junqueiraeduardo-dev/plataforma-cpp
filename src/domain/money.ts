const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brlNoCents = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})
const compact = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatBRL(cents: number): string {
  return brl.format(cents / 100)
}

/** Sem centavos, para eixos e números de destaque. */
export function formatBRLRound(cents: number): string {
  return brlNoCents.format(Math.round(cents / 100))
}

/** Rótulo curto de eixo: 0 / 500 / 1 mil / 2,5 mil. */
export function formatAxis(cents: number): string {
  const v = cents / 100
  return Math.abs(v) >= 10000 ? compact.format(v) : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
}

/**
 * Converte texto digitado em centavos. Aceita "1.234,56", "1234,5", "12.50" e "R$ 80".
 * Retorna null quando não é um valor válido.
 */
export function parseBRL(input: string): number | null {
  let s = input.replace(/[R$\s]/g, '')
  if (!s || !/^[\d.,]+$/.test(s)) return null
  if (s.includes(',')) {
    if ((s.match(/,/g) ?? []).length > 1) return null
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d+\.\d{1,2}$/.test(s)) {
    // ponto como separador decimal ("12.50")
  } else {
    s = s.replace(/\./g, '')
  }
  const value = Number(s)
  if (!Number.isFinite(value)) return null
  return Math.round(value * 100)
}

/** Centavos para o texto de um campo de formulário ("1234,56"). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}
