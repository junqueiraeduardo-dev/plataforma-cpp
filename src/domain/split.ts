import type { ID, Split } from './types'

/**
 * Parte de cada morador em centavos. A soma sempre fecha com `amount`:
 * os centavos que sobram do arredondamento são distribuídos de forma determinística.
 */
export function computeShares(amount: number, split: Split): Record<ID, number> {
  const ids = Object.keys(split.shares).sort()
  if (ids.length === 0) return {}

  if (split.mode === 'exact') {
    return Object.fromEntries(ids.map((id) => [id, split.shares[id]]))
  }

  const weights = ids.map((id) => (split.mode === 'equal' ? 1 : split.shares[id]))
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return Object.fromEntries(ids.map((id) => [id, 0]))

  const raw = weights.map((w) => (amount * w) / total)
  const floors = raw.map(Math.floor)
  let remainder = amount - floors.reduce((a, b) => a + b, 0)

  // maior resto primeiro; empate decide pela ordem dos ids
  const order = raw
    .map((r, i) => ({ i, frac: r - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of order) {
    if (remainder <= 0) break
    floors[i] += 1
    remainder -= 1
  }
  return Object.fromEntries(ids.map((id, i) => [id, floors[i]]))
}

/** Mensagem de erro para uma divisão inválida, ou null se estiver correta. */
export function splitError(amount: number, split: Split): string | null {
  const values = Object.values(split.shares)
  if (values.length === 0) return 'Escolha ao menos um morador para dividir.'
  if (values.some((v) => !Number.isFinite(v) || v < 0)) return 'Os valores da divisão não podem ser negativos.'
  const sum = values.reduce((a, b) => a + b, 0)
  if (split.mode === 'percent' && Math.abs(sum - 100) > 0.001) {
    return `Os percentuais somam ${formatPct(sum)}%; precisam somar 100%.`
  }
  if (split.mode === 'exact' && sum !== amount) {
    const diff = (amount - sum) / 100
    return diff > 0
      ? `Faltam R$ ${diff.toFixed(2).replace('.', ',')} para fechar o valor.`
      : `A divisão passa do valor em R$ ${Math.abs(diff).toFixed(2).replace('.', ',')}.`
  }
  return null
}

function formatPct(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}

export function equalSplit(memberIds: ID[]): Split {
  return { mode: 'equal', shares: Object.fromEntries(memberIds.map((id) => [id, 1])) }
}
