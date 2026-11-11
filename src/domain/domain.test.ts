import { describe, expect, it } from 'vitest'
import { parseAppData } from '@/data/schema'
import { buildSeed } from '@/data/seed'
import { allExpenses, cumulativeByDay, total } from './expenses'
import { formatBRL, parseBRL } from './money'
import { computeBalances, simplifyDebts } from './settle'
import { computeShares, equalSplit, splitError } from './split'
import { chargesBetween, monthlyCost, nextCharge, yearlyCost } from './subscriptions'
import type { Note, SubscriptionProps } from './types'
import { backlinksFor, buildGraph, localGraph, parseWikilinks, titleKey } from './wikilinks'

const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)

describe('dinheiro', () => {
  it('interpreta valores digitados em formato brasileiro', () => {
    expect(parseBRL('1.234,56')).toBe(123456)
    expect(parseBRL('12,5')).toBe(1250)
    expect(parseBRL('12.50')).toBe(1250)
    expect(parseBRL('R$ 80')).toBe(8000)
    expect(parseBRL('1.000')).toBe(100000)
    expect(parseBRL('0,1')).toBe(10)
    expect(parseBRL('19,99')).toBe(1999)
  })
  it('recusa texto que não é valor', () => {
    expect(parseBRL('')).toBeNull()
    expect(parseBRL('abc')).toBeNull()
    expect(parseBRL('1,2,3')).toBeNull()
    expect(parseBRL('-5')).toBeNull()
  })
  it('formata em reais', () => {
    expect(formatBRL(123456).replace(/\s/g, ' ')).toBe('R$ 1.234,56')
  })
})

describe('divisão de gastos', () => {
  it('divide por igual e distribui os centavos que sobram', () => {
    const shares = computeShares(10000, equalSplit(['a', 'b', 'c']))
    expect(shares).toEqual({ a: 3334, b: 3333, c: 3333 })
    expect(sum(shares)).toBe(10000)
  })
  it('fecha a soma em qualquer valor e número de pessoas', () => {
    for (const amount of [1, 2, 7, 99, 100, 1001, 285000, 999999]) {
      for (const n of [1, 2, 3, 4, 7]) {
        const ids = Array.from({ length: n }, (_, i) => `m${i}`)
        expect(sum(computeShares(amount, equalSplit(ids)))).toBe(amount)
      }
    }
  })
  it('divide por percentual com o método do maior resto', () => {
    const shares = computeShares(285000, { mode: 'percent', shares: { a: 40, b: 30, c: 30 } })
    expect(shares).toEqual({ a: 114000, b: 85500, c: 85500 })
    const odd = computeShares(1000, { mode: 'percent', shares: { a: 33.3, b: 33.3, c: 33.4 } })
    expect(sum(odd)).toBe(1000)
  })
  it('respeita valores exatos', () => {
    expect(computeShares(5000, { mode: 'exact', shares: { a: 4000, b: 1000 } })).toEqual({ a: 4000, b: 1000 })
  })
  it('explica divisões inválidas', () => {
    expect(splitError(5000, { mode: 'equal', shares: {} })).toMatch(/ao menos um/)
    expect(splitError(5000, { mode: 'percent', shares: { a: 50, b: 40 } })).toMatch(/90%/)
    expect(splitError(5000, { mode: 'exact', shares: { a: 3000, b: 1000 } })).toMatch(/Faltam R\$ 10,00/)
    expect(splitError(5000, { mode: 'exact', shares: { a: 3000, b: 3000 } })).toMatch(/passa do valor/)
    expect(splitError(5000, { mode: 'exact', shares: { a: 3000, b: 2000 } })).toBeNull()
  })
})

describe('acerto entre moradores', () => {
  const expense = (payer: string, amount: number, shares: Record<string, number>) => ({
    id: 'x',
    date: '2026-01-01',
    description: 'x',
    amount,
    category_id: 'outros' as const,
    payer_id: payer,
    shares,
    source: 'transaction' as const,
  })

  it('calcula quem deve e zera com as transferências sugeridas', () => {
    const expenses = [
      expense('a', 9000, { a: 3000, b: 3000, c: 3000 }),
      expense('b', 3000, { a: 1000, b: 1000, c: 1000 }),
    ]
    const balances = computeBalances(['a', 'b', 'c'], expenses, [])
    expect(balances).toEqual({ a: 5000, b: -1000, c: -4000 })
    expect(sum(balances)).toBe(0)

    const transfers = simplifyDebts(balances)
    expect(transfers).toEqual([
      { from_id: 'c', to_id: 'a', amount: 4000 },
      { from_id: 'b', to_id: 'a', amount: 1000 },
    ])

    const settled = computeBalances(
      ['a', 'b', 'c'],
      expenses,
      transfers.map((t, i) => ({ ...t, id: String(i), household_id: 'h', date: '2026-01-02', created_at: '' })),
    )
    expect(Object.values(settled).every((v) => v === 0)).toBe(true)
  })

  it('nunca sugere mais que n−1 transferências', () => {
    const balances = { a: 700, b: 300, c: -200, d: -350, e: -450 }
    const transfers = simplifyDebts(balances)
    expect(transfers.length).toBeLessThanOrEqual(4)
    expect(transfers.reduce((s, t) => s + t.amount, 0)).toBe(1000)
  })

  it('não sugere nada quando está tudo quitado', () => {
    expect(simplifyDebts({ a: 0, b: 0 })).toEqual([])
  })
})

describe('assinaturas', () => {
  const base: SubscriptionProps = {
    price: 4490,
    cycle: 'monthly',
    start_date: '2026-01-31',
    end_date: null,
    status: 'active',
    payer_id: 'a',
    shared_with: ['a'],
    group: 'Streaming',
    payment_method: '',
  }

  it('mantém o dia 31 sem escorregar nos meses curtos', () => {
    expect(chargesBetween(base, '2026-01-01', '2026-05-31')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ])
  })
  it('trata ano bissexto na cobrança anual', () => {
    const leap = { ...base, cycle: 'yearly' as const, start_date: '2024-02-29' }
    expect(chargesBetween(leap, '2024-01-01', '2028-12-31')).toEqual([
      '2024-02-29',
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
    ])
  })
  it('acha a próxima cobrança, inclusive quando é hoje', () => {
    expect(nextCharge(base, '2026-02-28')).toBe('2026-02-28')
    expect(nextCharge(base, '2026-03-01')).toBe('2026-03-31')
    expect(nextCharge({ ...base, start_date: '2027-01-10' }, '2026-03-01')).toBe('2027-01-10')
  })
  it('para de cobrar ao pausar ou cancelar', () => {
    const paused = { ...base, status: 'paused' as const, end_date: '2026-03-15' }
    expect(chargesBetween(paused, '2026-01-01', '2026-12-31')).toEqual(['2026-01-31', '2026-02-28'])
    expect(nextCharge(paused, '2026-03-01')).toBeNull()
  })
  it('cobra semanal e trimestral', () => {
    expect(chargesBetween({ ...base, cycle: 'weekly', start_date: '2026-03-02' }, '2026-03-01', '2026-03-31')).toHaveLength(5)
    expect(chargesBetween({ ...base, cycle: 'quarterly', start_date: '2026-01-15' }, '2026-01-01', '2026-12-31')).toEqual([
      '2026-01-15',
      '2026-04-15',
      '2026-07-15',
      '2026-10-15',
    ])
  })
  it('normaliza o custo por mês e por ano', () => {
    expect(monthlyCost(base)).toBe(4490)
    expect(monthlyCost({ ...base, cycle: 'yearly', price: 16680 })).toBe(1390)
    expect(monthlyCost({ ...base, cycle: 'quarterly', price: 9000 })).toBe(3000)
    expect(yearlyCost(base)).toBe(53880)
    expect(yearlyCost({ ...base, cycle: 'weekly', price: 1000 })).toBe(52000)
  })
})

describe('wikilinks', () => {
  const note = (title: string, body: string, kind: Note['kind'] = 'note'): Note => ({
    id: title,
    household_id: 'h',
    title,
    kind,
    body,
    subscription: null,
    created_at: '',
    updated_at: '',
  })

  it('extrai destino, apelido e posição', () => {
    const links = parseWikilinks('Ver [[Netflix]] e [[Cartão Nubank|o cartão]].')
    expect(links.map((l) => [l.target, l.alias])).toEqual([
      ['Netflix', null],
      ['Cartão Nubank', 'o cartão'],
    ])
    expect('Ver [[Netflix]]'.slice(links[0].start, links[0].end)).toBe('[[Netflix]]')
  })
  it('ignora colchetes vazios ou quebrados', () => {
    expect(parseWikilinks('[[]] [[ ]] [[sem fim')).toEqual([])
  })
  it('compara títulos sem acento nem caixa', () => {
    expect(titleKey('  Cartão   NUBANK ')).toBe('cartao nubank')
  })
  it('monta backlinks com o trecho do texto', () => {
    const a = note('Netflix', '')
    const b = note('Revisão', '- [[netflix]] — testar plano com anúncios')
    const back = backlinksFor(a, [a, b], [])
    expect(back).toHaveLength(1)
    expect(back[0].note.title).toBe('Revisão')
    expect(back[0].snippet).toBe('netflix — testar plano com anúncios')
  })
  it('monta o grafo com nós fantasma e sem arestas duplicadas', () => {
    const a = note('A', '[[B]] [[B]] [[Inexistente]]')
    const b = note('B', '[[A]]')
    const g = buildGraph([a, b], [])
    expect(g.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'inexistente'])
    expect(g.nodes.find((n) => n.id === 'inexistente')?.kind).toBe('ghost')
    expect(g.links).toHaveLength(2)
    expect(localGraph(g, 'b').nodes.map((n) => n.id).sort()).toEqual(['a', 'b'])
  })
  it('liga assinaturas a pagador, grupo e forma de pagamento', () => {
    const sub: Note = {
      ...note('Netflix', '', 'subscription'),
      subscription: {
        price: 4490,
        cycle: 'monthly',
        start_date: '2026-01-10',
        end_date: null,
        status: 'active',
        payer_id: 'm1',
        shared_with: ['m1', 'm2'],
        group: 'Streaming',
        payment_method: 'Cartão Nubank',
      },
    }
    const members = [
      { id: 'm1', household_id: 'h', name: 'Ana', color: '', created_at: '' },
      { id: 'm2', household_id: 'h', name: 'Bruno', color: '', created_at: '' },
    ]
    const g = buildGraph([sub], members)
    expect(g.links.map((l) => l.target).sort()).toEqual(['ana', 'bruno', 'cartao nubank', 'streaming'])
    expect(g.nodes.find((n) => n.id === 'netflix')?.monthly).toBe(4490)
  })
})

describe('dados de exemplo', () => {
  const seed = buildSeed('2026-11-10')

  it('passam na mesma validação usada na importação', () => {
    const parsed = parseAppData(JSON.parse(JSON.stringify(seed)))
    expect(parsed.ok).toBe(true)
  })
  it('não têm lançamentos no futuro e fecham as divisões', () => {
    expect(seed.transactions.every((t) => t.date <= '2026-11-10')).toBe(true)
    const expenses = allExpenses(seed, '2000-01-01', '2026-11-10')
    for (const e of expenses) expect(sum(e.shares)).toBe(e.amount)
    const balances = computeBalances(seed.members.map((m) => m.id), expenses, seed.settlements)
    expect(sum(balances)).toBe(0)
  })
  it('incluem as cobranças de assinatura no mês', () => {
    const month = allExpenses(seed, '2026-11-01', '2026-11-30')
    expect(month.some((e) => e.source === 'subscription' && e.description === 'Netflix')).toBe(true)
    expect(month.some((e) => e.description === 'Max')).toBe(false)
    const cumulative = cumulativeByDay(month, 30)
    expect(cumulative[29]).toBe(total(month))
  })
  it('recusa backup com morador inexistente', () => {
    const broken = JSON.parse(JSON.stringify(seed))
    broken.transactions[0].payer_id = 'ninguem'
    const parsed = parseAppData(broken)
    expect(parsed.ok).toBe(false)
  })
})

describe('cores e tema', () => {
  it('normaliza hexadecimais e recusa o resto', async () => {
    const { normalizeHex } = await import('./color')
    expect(normalizeHex('#ABC')).toBe('#aabbcc')
    expect(normalizeHex('d4ee40')).toBe('#d4ee40')
    expect(normalizeHex('red')).toBeNull()
    expect(normalizeHex('#12345')).toBeNull()
  })
  it('calcula contraste e escolhe a tinta legível', async () => {
    const { contrast, readableOn, INK_DARK, INK_LIGHT } = await import('./color')
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrast('#777777', '#777777')).toBe(1)
    expect(readableOn('#d4ee40')).toBe(INK_DARK)
    expect(readableOn('#e50914')).toBe(INK_LIGHT)
    expect(readableOn('#08161c')).toBe(INK_LIGHT)
  })
  it('usa o padrão para o que o usuário não alterou e ignora valores inválidos', async () => {
    const { effectiveTheme, DEFAULT_THEME, themeVars, themeIsDark, categoryColors } = await import('./theme')
    expect(effectiveTheme(undefined)).toEqual(DEFAULT_THEME)
    const custom = { theme: { primary: '#0B3D91', background: 'lixo' }, category_colors: { lazer: '#123456' } }
    expect(effectiveTheme(custom)).toEqual({ ...DEFAULT_THEME, primary: '#0b3d91' })
    expect(categoryColors(custom).lazer).toBe('#123456')
    expect(themeVars(custom)['--primary-foreground']).toBe('#ffffff')
    expect(themeVars(custom)['--cat-lazer']).toBe('#123456')
    expect(themeIsDark(undefined)).toBe(true)
    expect(themeIsDark({ theme: { background: '#f5f1e6' } })).toBe(false)
  })
  it('todos os temas prontos têm texto legível sobre fundo e cartões', async () => {
    const { PRESETS } = await import('./theme')
    const { contrast, mix } = await import('./color')
    for (const { name, theme } of PRESETS) {
      expect(contrast(theme.foreground, theme.background), name).toBeGreaterThanOrEqual(7)
      expect(contrast(theme.foreground, theme.card), name).toBeGreaterThanOrEqual(7)
      // texto secundário (72% do texto) ainda precisa passar de 4,5:1
      expect(contrast(mix(theme.foreground, theme.background, 0.28), theme.card), name).toBeGreaterThanOrEqual(4.5)
      expect(contrast(theme.primary, theme.background), name).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('aceita backups antigos, sem ajustes de aparência nem ícones', () => {
    const seed = buildSeed('2026-11-10')
    const old = JSON.parse(JSON.stringify(seed))
    delete old.settings
    for (const n of old.notes) if (n.subscription) { delete n.subscription.icon; delete n.subscription.color }
    expect(parseAppData(old).ok).toBe(true)
    const bad = JSON.parse(JSON.stringify(seed))
    bad.settings = { theme: { primary: 'vermelho' } }
    expect(parseAppData(bad).ok).toBe(false)
  })
})

describe('mercado', () => {
  it('o catálogo não tem chaves nem nomes repetidos', async () => {
    const { CATALOG, SECTIONS } = await import('@/features/market/catalog')
    expect(CATALOG.length).toBeGreaterThan(120)
    expect(new Set(CATALOG.map((p) => p.key)).size).toBe(CATALOG.length)
    expect(new Set(CATALOG.map((p) => titleKey(p.name))).size).toBe(CATALOG.length)
    for (const s of SECTIONS) if (s.id !== 'outros') expect(CATALOG.some((p) => p.section === s.id), s.id).toBe(true)
  })
  it('a lista de exemplo usa a mesma chave que a digitação gera', async () => {
    const { itemKey } = await import('./shopping')
    const seed = buildSeed('2026-11-10')
    expect(seed.shopping.length).toBeGreaterThan(5)
    for (const item of seed.shopping) expect(item.product_key, item.name).toBe(itemKey(item.name, item.detail))
    expect(new Set(seed.shopping.map((i) => i.product_key)).size).toBe(seed.shopping.length)
  })
  it('backups sem lista de mercado continuam válidos e nascem com a lista vazia', () => {
    const old = JSON.parse(JSON.stringify(buildSeed('2026-11-10')))
    delete old.products
    delete old.shopping
    const parsed = parseAppData(old)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.data.products).toEqual([])
      expect(parsed.data.shopping).toEqual([])
    }
  })
  it('recusa imagem de ícone que não seja raster gerada pelo app', () => {
    const data = JSON.parse(JSON.stringify(buildSeed('2026-11-10')))
    const sub = data.notes.find((n: Note) => n.subscription)
    sub.subscription.image = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='
    expect(parseAppData(data).ok).toBe(false)
    sub.subscription.image = 'data:image/png;base64,iVBORw0KGgo='
    expect(parseAppData(data).ok).toBe(true)
  })
})
