// A biblioteca não publica tipos; só usamos a força de colisão.
declare module 'd3-force-3d' {
  export function forceCollide<N = unknown>(radius?: number | ((node: N) => number)): {
    strength(value: number): unknown
    iterations(value: number): unknown
  }
}
