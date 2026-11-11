import { describe, expect, it } from 'vitest'
import { CENTER_R, CLUSTER_GAP, layoutClusters, placeRing } from './payerLayout'

const items = (n: number, r = 16) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, r }))
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

describe('grafo por pagador', () => {
  it('nenhuma assinatura encosta em outra nem no pagador, com 1 a 24 itens', () => {
    for (let n = 1; n <= 24; n++) {
      const { items: placed } = placeRing(items(n, 20))
      for (const a of placed) {
        // sobra espaço para o nome do pagador embaixo do círculo central
        expect(Math.hypot(a.x, a.y)).toBeGreaterThanOrEqual(CENTER_R + 20 + 30)
        for (const b of placed) if (a !== b) expect(dist(a, b)).toBeGreaterThanOrEqual(20 * 2 + 14)
      }
    }
  })

  it('grupos nunca se sobrepõem e ficam a uma folga fixa do vizinho', () => {
    const groups = [
      { id: 'a', items: items(6) },
      { id: 'b', items: items(4) },
      { id: 'c', items: items(13) },
      { id: 'd', items: items(1) },
    ]
    for (const aspect of [0.6, 1, 1.8, 3]) {
      const { clusters } = layoutClusters(groups, aspect)
      expect(clusters).toHaveLength(4)
      for (const a of clusters) {
        for (const b of clusters) {
          if (a === b) continue
          expect(dist(a, b)).toBeGreaterThanOrEqual(a.extent + b.extent + CLUSTER_GAP - 0.001)
        }
        // cada item fica dentro do raio do seu grupo
        for (const i of a.items) expect(dist(i, a)).toBeLessThanOrEqual(a.extent)
      }
    }
  })

  it('tela estreita empilha, tela larga põe lado a lado', () => {
    const groups = [
      { id: 'a', items: items(5) },
      { id: 'b', items: items(5) },
      { id: 'c', items: items(5) },
    ]
    const tall = layoutClusters(groups, 0.5).clusters
    expect(new Set(tall.map((c) => Math.round(c.x))).size).toBe(1)
    const wide = layoutClusters(groups, 3).clusters
    expect(new Set(wide.map((c) => Math.round(c.y))).size).toBe(1)
  })
})
