import { describe, expect, it } from 'vitest'
import { parseQuickAdd } from './quickAdd'

// 10 de novembro de 2026 é uma terça-feira
const ctx = {
  today: '2026-11-10',
  members: [
    { id: 'a', name: 'Ana' },
    { id: 'b', name: 'Bruno' },
    { id: 'c', name: 'Maria Clara' },
  ],
}
const q = (text: string) => parseQuickAdd(text, ctx)

describe('lançamento rápido', () => {
  it('lê descrição, valor, data e pagador de uma frase', () => {
    expect(q('pizza 89,90 ontem bruno')).toMatchObject({
      description: 'Pizza',
      amount: 8990,
      date: '2026-11-09',
      category_id: 'lazer',
      payer_id: 'b',
      found: { amount: true, date: true, category: true, payer: true },
    })
  })
  it('assume hoje e o primeiro morador quando a frase não diz', () => {
    const r = q('mercado do mês 412,35')
    expect(r).toMatchObject({ description: 'Mercado do mês', amount: 41235, date: '2026-11-10', category_id: 'mercado', payer_id: 'a' })
    expect(r.found).toEqual({ amount: true, date: false, category: true, payer: false })
  })
  it('entende vários formatos de valor', () => {
    expect(q('aluguel 2.850').amount).toBe(285000)
    expect(q('aluguel 2.850,00').amount).toBe(285000)
    expect(q('cafe 7.5').amount).toBe(750)
    expect(q('uber r$ 23').amount).toBe(2300)
    expect(q('uber R$23,40').amount).toBe(2340)
    expect(q('farmacia 35 reais').description).toBe('Farmacia')
  })
  it('prefere o número com centavos quando há mais de um', () => {
    const r = q('2 pizzas 89,90')
    expect(r.amount).toBe(8990)
    expect(r.description).toBe('2 pizzas')
  })
  it('entende datas relativas, dia do mês, dia da semana e dd/mm', () => {
    expect(q('gasolina 200 anteontem').date).toBe('2026-11-08')
    expect(q('gasolina 200 hoje').date).toBe('2026-11-10')
    expect(q('luz 180 dia 5').date).toBe('2026-11-05')
    expect(q('luz 180 dia 25').date).toBe('2026-10-25') // dia 25 ainda não chegou: é o do mês passado
    expect(q('feira 90 sábado').date).toBe('2026-11-07')
    expect(q('feira 90 terça').date).toBe('2026-11-10')
    expect(q('cinema 60 03/11').date).toBe('2026-11-03')
    expect(q('cinema 60 20/12').date).toBe('2025-12-20') // sem ano e no futuro: é o do ano passado
    expect(q('cinema 60 31/02').date).toBe('2026-02-28')
  })
  it('não confunde o dia do mês com o valor', () => {
    const r = q('internet dia 15 119,90')
    expect(r).toMatchObject({ amount: 11990, date: '2026-10-15', description: 'Internet', category_id: 'contas' })
  })
  it('reconhece pagador com nome composto e com "pagou"', () => {
    expect(q('farmácia 45 maria clara').payer_id).toBe('c')
    expect(q('bruno pagou 60 de gasolina')).toMatchObject({ payer_id: 'b', amount: 6000, description: 'Gasolina', category_id: 'transporte' })
    expect(q('pizza 80 @bruno').payer_id).toBe('b')
  })
  it('nome no meio da descrição não vira pagador', () => {
    const r = q('bolo da ana 45')
    expect(r.description).toBe('Bolo da ana')
    expect(r.found.payer).toBe(false)
  })
  it('aceita valor colado, com ponto final e depois do nome de quem pagou', () => {
    expect(q('luz150')).toMatchObject({ description: 'Luz', amount: 15000, category_id: 'contas' })
    expect(q('uber23,40')).toMatchObject({ description: 'Uber', amount: 2340 })
    expect(q('Luz 200.')).toMatchObject({ description: 'Luz', amount: 20000 })
    expect(q('luz bruno 150')).toMatchObject({ description: 'Luz', amount: 15000, payer_id: 'b' })
  })
  it('tira o verbo do começo da frase', () => {
    expect(q('paguei 200 de luz').description).toBe('Luz')
    expect(q('gastei 35 na farmácia').description).toBe('Farmácia')
  })
  it('reconhece a conta pelo nome da concessionária', () => {
    expect(q('Enel 180').category_id).toBe('contas')
    expect(q('conta sabesp 90').category_id).toBe('contas')
    expect(q('net 120').category_id).toBe('contas')
    expect(q('recarga vivo 30').category_id).toBe('contas')
    expect(q('conta da claro 99,90').category_id).toBe('contas')
    expect(q('show ao vivo 80').category_id).toBe('lazer')
    expect(q('iogurte light 9').category_id).not.toBe('contas')
  })
  it('sem valor, devolve amount nulo e mantém o resto', () => {
    const r = q('padaria ontem')
    expect(r.amount).toBeNull()
    expect(r.found.amount).toBe(false)
    expect(r).toMatchObject({ description: 'Padaria', date: '2026-11-09', category_id: 'mercado' })
  })
  it('descrição desconhecida cai em Outros; texto vazio não quebra', () => {
    expect(q('coisa estranha 10').category_id).toBe('outros')
    expect(q('   ')).toMatchObject({ description: '', amount: null, date: '2026-11-10' })
    expect(q('45')).toMatchObject({ description: '', amount: 4500 })
  })
  it('funciona sem moradores cadastrados', () => {
    expect(parseQuickAdd('pizza 50', { today: '2026-11-10', members: [] }).payer_id).toBeNull()
  })
})
