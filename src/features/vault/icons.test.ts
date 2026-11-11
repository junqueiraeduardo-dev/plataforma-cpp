import { describe, expect, it } from 'vitest'
import type { Note, SubscriptionProps } from '@/domain/types'
import { matchBrand } from './brands'
import { monogram, subscriptionLook } from './subscriptionIcon'

const sub = (extra: Partial<SubscriptionProps> = {}): SubscriptionProps => ({
  price: 1000,
  cycle: 'monthly',
  start_date: '2026-01-01',
  end_date: null,
  status: 'active',
  payer_id: 'a',
  shared_with: ['a'],
  group: '',
  payment_method: '',
  ...extra,
})
const note = (title: string, extra?: Partial<SubscriptionProps>): Pick<Note, 'title' | 'subscription'> => ({ title, subscription: sub(extra) })

describe('logotipos de assinatura', () => {
  it('reconhece a marca pelo nome, sem diferenciar caixa ou acento', () => {
    expect(matchBrand('Netflix')?.slug).toBe('netflix')
    expect(matchBrand('NETFLIX Padrão')?.slug).toBe('netflix')
    expect(matchBrand('Spotify Família')?.slug).toBe('spotify')
    expect(matchBrand('iCloud 200 GB')?.slug).toBe('icloud')
    expect(matchBrand('Google One 100 GB')?.slug).toBe('google')
  })
  it('prefere o apelido mais longo', () => {
    expect(matchBrand('YouTube Music')?.slug).toBe('youtubemusic')
    expect(matchBrand('YouTube Premium')?.slug).toBe('youtube')
    expect(matchBrand('HBO Max')?.slug).toBe('hbomax')
  })
  it('exige palavra inteira', () => {
    expect(matchBrand('Max')?.slug).toBe('hbomax')
    expect(matchBrand('Maxmilhas')).toBeNull()
    expect(matchBrand('Academia do bairro')).toBeNull()
  })
  it('usa a cor da marca no automático e respeita a escolha do usuário', () => {
    const auto = subscriptionLook(note('Netflix'))
    expect(auto.icon.kind).toBe('brand')
    expect(auto.color).toBe('#e50914')
    expect(auto.autoIcon && auto.autoColor).toBe(true)

    const custom = subscriptionLook(note('Netflix', { icon: 'icon:tv', color: '#123456' }))
    expect(custom.icon.kind).toBe('generic')
    expect(custom.color).toBe('#123456')
    expect(custom.autoIcon || custom.autoColor).toBe(false)
  })
  it('sem logotipo, usa o selo da marca conhecida e depois as iniciais', () => {
    const disney = subscriptionLook(note('Disney+'))
    expect(disney.icon).toMatchObject({ kind: 'text', text: 'D+' })
    expect(disney.color).toBe('#113ccf')
    expect(subscriptionLook(note('Globoplay')).icon).toMatchObject({ kind: 'text', text: 'gp' })
    // marcas que ganharam o logotipo original deixam de usar selo de letras
    expect(subscriptionLook(note('Xbox Game Pass')).icon).toMatchObject({ kind: 'brand', label: 'Xbox' })
    expect(subscriptionLook(note('Amazon Prime')).icon).toMatchObject({ kind: 'brand', label: 'Prime Video' })
    expect(subscriptionLook(note('Microsoft 365')).icon).toMatchObject({ kind: 'brand', label: 'Microsoft 365' })
    expect(subscriptionLook(note('ChatGPT Plus')).icon).toMatchObject({ kind: 'brand', label: 'ChatGPT' })

    const unknown = subscriptionLook(note('Clube do café', { group: 'Casa' }))
    expect(unknown.icon).toMatchObject({ kind: 'text', text: 'CC' })
    expect(unknown.color).toMatch(/^#[0-9a-f]{6}$/)
  })
  it('monta iniciais ignorando artigos e tamanhos', () => {
    expect(monogram('Seguro residencial')).toBe('SR')
    expect(monogram('Clube do café')).toBe('CC')
    expect(monogram('Max')).toBe('M')
    expect(monogram('Star+')).toBe('S+')
    expect(monogram('iCloud 200 GB')).toBe('I')
    expect(monogram('   ')).toBe('?')
  })
  it('usa a imagem enviada só quando ela existe', () => {
    const png = 'data:image/png;base64,AAAA'
    expect(subscriptionLook(note('Qualquer', { icon: 'image', image: png })).icon).toMatchObject({ kind: 'image', src: png })
    expect(subscriptionLook(note('Qualquer', { icon: 'image' })).icon.kind).toBe('text')
  })
  it('ignora escolhas que deixaram de existir', () => {
    expect(subscriptionLook(note('Netflix', { icon: 'brand:nao-existe' })).icon.kind).toBe('brand')
    expect(subscriptionLook(note('Netflix', { icon: 'icon:nao-existe' })).autoIcon).toBe(true)
  })
})
