import { describe, expect, it } from 'vitest'
import { autoExpenseIcon, EXPENSE_ICONS, expenseIcon } from './expenseIcons'

const auto = (description: string) => autoExpenseIcon(description, 'outros').key

describe('ícones de gasto', () => {
  it('reconhece o gasto pela descrição', () => {
    expect(auto('Aluguel')).toBe('aluguel')
    expect(auto('Condomínio')).toBe('condominio')
    expect(auto('Conta de luz')).toBe('luz')
    expect(auto('Conta de água')).toBe('agua')
    expect(auto('Botijão de gás')).toBe('gas')
    expect(auto('Internet fibra 500 MB')).toBe('internet')
    expect(auto('Feira de sábado')).toBe('feira')
    expect(auto('Padaria e frios')).toBe('padaria')
    expect(auto('Mercado do mês')).toBe('mercado')
    expect(auto('Atacadão')).toBe('mercado')
    expect(auto('Churrasco no terraço')).toBe('churrasco')
    expect(auto('Pizza de sexta')).toBe('pizza')
    expect(auto('Delivery japonês')).toBe('japones')
    expect(auto('Bar com amigos')).toBe('bar')
    expect(auto('Cinema')).toBe('cinema')
    expect(auto('Corrida de app')).toBe('corrida')
    expect(auto('Combustível')).toBe('combustivel')
    expect(auto('Bilhete único')).toBe('onibus')
    expect(auto('Farmácia')).toBe('farmacia')
    expect(auto('Consulta dentista')).toBe('consulta')
    expect(auto('Conserto da torneira')).toBe('conserto')
    expect(auto('Lâmpadas e pilhas')).toBe('lampada')
    expect(auto('Produtos de limpeza')).toBe('limpeza')
  })
  it('não confunde palavras parecidas', () => {
    expect(auto('Barbeiro')).toBe('cabelo')
    expect(auto('Gasolina')).toBe('combustivel')
    expect(auto('Metrópole Shopping')).toBe('pacote')
  })
  it('sem pista na descrição, usa o padrão da categoria', () => {
    expect(autoExpenseIcon('Coisas diversas', 'moradia').key).toBe('casa')
    expect(autoExpenseIcon('Coisas diversas', 'saude').key).toBe('saude')
    expect(autoExpenseIcon('', 'lazer').key).toBe('festa')
  })
  it('respeita o ícone escolhido à mão e ignora chaves desconhecidas', () => {
    expect(expenseIcon({ description: 'Aluguel', category_id: 'moradia', icon: 'presente' }).key).toBe('presente')
    expect(expenseIcon({ description: 'Aluguel', category_id: 'moradia', icon: 'nao-existe' }).key).toBe('aluguel')
  })
  it('açougue vai para o mercado e churrasco para o lazer', () => {
    expect(auto('Açougue do bairro')).toBe('carnes')
    expect(auto('Carne para a semana')).toBe('carnes')
  })
  it('não tem chaves repetidas', () => {
    expect(new Set(EXPENSE_ICONS.map((i) => i.key)).size).toBe(EXPENSE_ICONS.length)
  })
})
