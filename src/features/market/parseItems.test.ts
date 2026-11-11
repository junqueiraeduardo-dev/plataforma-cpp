import { describe, expect, it } from 'vitest'
import type { Product } from '@/domain/types'
import { guessSection, itemKey, parseItems, suggest } from './parseItems'

const names = (text: string) => parseItems(text).map((i) => `${i.quantity}× ${i.name}${i.detail ? ` [${i.detail}]` : ''}`)

describe('lista digitada', () => {
  it('lê um item simples e capitaliza', () => {
    expect(names('leite')).toEqual(['1× Leite'])
    expect(names('  pão   francês ')).toEqual(['1× Pão francês'])
  })
  it('entende quantidade em vários formatos', () => {
    expect(names('2 leite')).toEqual(['2× Leite'])
    expect(names('3x iogurte')).toEqual(['3× Iogurte'])
    expect(names('3 x iogurte')).toEqual(['3× Iogurte'])
    expect(names('leite x2')).toEqual(['2× Leite'])
    expect(names('leite 2x')).toEqual(['2× Leite'])
    expect(names('ovos (12)')).toEqual(['12× Ovos'])
  })
  it('guarda a medida como detalhe, sem virar quantidade', () => {
    expect(names('2 kg tomate')).toEqual(['1× Tomate [2 kg]'])
    expect(names('500g de queijo')).toEqual(['1× Queijo [500 g]'])
    expect(names('1,5 kg carne moída')).toEqual(['1× Carne moída [1,5 kg]'])
    expect(names('2 litros de leite')).toEqual(['1× Leite [2 litros]'])
  })
  it('separa vários itens por linha, vírgula ou ponto e vírgula', () => {
    expect(names('arroz, feijão; 2 leite\ncafé')).toEqual(['1× Arroz', '1× Feijão', '2× Leite', '1× Café'])
  })
  it('aceita uma lista colada com marcadores', () => {
    expect(names('- banana\n* maçã\n• alface\n[ ] tomate\n1. arroz\n2) feijão')).toEqual([
      '1× Banana',
      '1× Maçã',
      '1× Alface',
      '1× Tomate',
      '1× Arroz',
      '1× Feijão',
    ])
  })
  it('soma repetidos na mesma entrada, sem diferenciar acento ou caixa', () => {
    expect(names('leite, Leite, 2 LEITE')).toEqual(['4× Leite'])
    expect(names('2 kg tomate, tomate')).toEqual(['1× Tomate [2 kg]', '1× Tomate'])
  })
  it('ignora entradas vazias e limita a quantidade', () => {
    expect(names(' , ;\n\n')).toEqual([])
    expect(names('5000 x balas')[0]).not.toMatch(/^5000/)
    expect(parseItems('999 leite, 5 leite')[0].quantity).toBe(999)
  })
  it('número que faz parte do nome não é quantidade', () => {
    expect(names('7up')).toEqual(['1× 7up'])
    expect(names('coca 2l')).toEqual(['1× Coca 2l'])
  })
  it('chave igual para o mesmo item escrito de formas diferentes', () => {
    expect(itemKey('Pão Francês', null)).toBe(itemKey('pao frances', undefined))
    expect(itemKey('Tomate', '2 kg')).not.toBe(itemKey('Tomate', null))
  })
})

describe('seção do mercado', () => {
  it('acha a seção pelo dicionário, inclusive no plural e com complemento', () => {
    expect(guessSection('banana')).toBe('hortifruti')
    expect(guessSection('Bananas')).toBe('hortifruti')
    expect(guessSection('pão francês')).toBe('padaria')
    expect(guessSection('queijo')).toBe('laticinios')
    expect(guessSection('queijo muçarela fatiado')).toBe('laticinios')
    expect(guessSection('detergente')).toBe('limpeza')
    expect(guessSection('papel higiênico')).toBe('higiene')
    expect(guessSection('ovos')).toBe('mercearia')
  })
  it('usa palavras-chave para o que não está no dicionário', () => {
    expect(guessSection('picanha')).toBe('carnes')
    expect(guessSection('suco de maracujá')).toBe('bebidas')
    expect(guessSection('sabão de coco')).toBe('limpeza')
    expect(guessSection('ração do Thor')).toBe('casa')
  })
  it('o que não reconhece vai para Outros', () => {
    expect(guessSection('kombucha')).toBe('outros')
    expect(guessSection('   ')).toBe('outros')
  })
  it('a escolha anterior da casa vale mais que o dicionário', () => {
    expect(guessSection('Banana', [{ name: 'banana', section: 'congelados' }])).toBe('congelados')
  })
})

describe('sugestões', () => {
  const product = (name: string, uses: number): Product => ({ id: name, household_id: 'h', name, section: 'mercearia', uses, created_at: '' })
  const memory = [product('Granola da feira', 5), product('Leite sem lactose', 9), product('Kombucha', 1)]

  it('sem texto, mostra os mais usados da casa', () => {
    expect(suggest('', memory, new Set()).map((s) => s.name)).toEqual(['Leite sem lactose', 'Granola da feira', 'Kombucha'])
  })
  it('com texto, os da casa vêm antes do dicionário', () => {
    const out = suggest('lei', memory, new Set())
    expect(out[0]).toMatchObject({ name: 'Leite sem lactose', own: true })
    expect(out.some((s) => s.name === 'Leite integral' && !s.own)).toBe(true)
    expect(out.length).toBeLessThanOrEqual(6)
  })
  it('não repete nomes e pula o que já está na lista', () => {
    const out = suggest('gran', [...memory, product('Granola', 2)], new Set(['granola da feira']))
    expect(out.map((s) => s.name)).toEqual(['Granola'])
  })
})
