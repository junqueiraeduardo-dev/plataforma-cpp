import type { CategoryId } from './types'
import { titleKey } from './wikilinks'

export interface ExpenseRule {
  key: string
  label: string
  /** Categoria sugerida quando a descrição casa com a regra. */
  category: CategoryId
  /** Testado contra a descrição sem acentos e em minúsculas. */
  match?: RegExp
}

// Uma regra define, de uma vez, o ícone e a categoria sugerida de um gasto.
// A ordem importa: a primeira que casar vence, então o específico vem antes do genérico.
export const EXPENSE_RULES: ExpenseRule[] = [
  { key: 'aluguel', label: 'Aluguel', category: 'moradia', match: /alugue/ },
  { key: 'condominio', label: 'Condomínio', category: 'moradia', match: /condomin/ },
  { key: 'lampada', label: 'Lâmpadas e pilhas', category: 'outros', match: /lampada|pilha/ },
  { key: 'luz', label: 'Luz', category: 'contas', match: /\bluz\b|energia|eletric|\b(enel|cpfl|cemig|copel|celesc|coelba|celpe|equatorial|energisa|neoenergia|elektro)\b|\bconta (da )?light\b/ },
  { key: 'agua', label: 'Água', category: 'contas', match: /\bagua\b|saneamento|\b(sabesp|copasa|sanepar|cedae|caesb|embasa|corsan|casan|compesa|cagece|saneago)\b/ },
  { key: 'gas', label: 'Gás', category: 'contas', match: /\bgas\b|botijao/ },
  { key: 'internet', label: 'Internet', category: 'contas', match: /internet|wi-?fi|fibra|banda larga|\bnet\b|\blive tim\b/ },
  { key: 'celular', label: 'Celular', category: 'contas', match: /celular|telefone|recarga|^(?:conta|fatura|plano)?\s*(?:d[ao]\s+)?(?:vivo|claro|tim|oi)\b/ },
  { key: 'imposto', label: 'Impostos e taxas', category: 'moradia', match: /iptu|ipva|imposto|\btaxa\b|cartorio/ },
  { key: 'limpeza', label: 'Limpeza', category: 'outros', match: /limpeza|faxina|diarista/ },
  { key: 'lavanderia', label: 'Lavanderia', category: 'outros', match: /lavanderia/ },
  { key: 'feira', label: 'Feira', category: 'mercado', match: /feira|hortifruti|sacolao|quitanda/ },
  { key: 'padaria', label: 'Padaria', category: 'mercado', match: /padaria|\bpao\b|\bfrios\b/ },
  { key: 'churrasco', label: 'Churrasco', category: 'lazer', match: /churrasc/ },
  { key: 'carnes', label: 'Carnes', category: 'mercado', match: /acougue|\bcarne/ },
  { key: 'mercado', label: 'Mercado', category: 'mercado', match: /mercado|supermerc|atacad/ },
  { key: 'pizza', label: 'Pizza', category: 'lazer', match: /pizza/ },
  { key: 'japones', label: 'Japonês e peixes', category: 'lazer', match: /japones|sushi|temaki|peixar/ },
  { key: 'delivery', label: 'Delivery', category: 'lazer', match: /delivery|ifood|entrega|motoboy/ },
  { key: 'bar', label: 'Bar', category: 'lazer', match: /\bbar\b|cerveja|chopp?\b|boteco|happy hour/ },
  { key: 'vinho', label: 'Vinhos', category: 'lazer', match: /vinho|adega/ },
  { key: 'cafe', label: 'Café', category: 'lazer', match: /\bcafe\b|cafeteria/ },
  { key: 'sorvete', label: 'Doces e sorvete', category: 'lazer', match: /sorvete|\bacai\b|\bdoce|sobremesa|confeitaria/ },
  { key: 'restaurante', label: 'Restaurante', category: 'lazer', match: /restaurante|almoco|jantar|lanche|hamburg/ },
  { key: 'cinema', label: 'Cinema', category: 'lazer', match: /cinema|filme/ },
  { key: 'ingresso', label: 'Shows e ingressos', category: 'lazer', match: /\bshow\b|teatro|ingresso|evento|museu/ },
  { key: 'festa', label: 'Festa', category: 'lazer', match: /festa|aniversario|comemora/ },
  { key: 'presente', label: 'Presente', category: 'outros', match: /presente/ },
  { key: 'jogos', label: 'Jogos', category: 'lazer', match: /\bjogos?\b|\bgames?\b/ },
  { key: 'combustivel', label: 'Combustível', category: 'transporte', match: /combustivel|gasolina|etanol|\bposto\b|diesel/ },
  { key: 'estacionamento', label: 'Estacionamento', category: 'transporte', match: /estacionamento|zona azul|pedagio/ },
  { key: 'corrida', label: 'Corrida de app', category: 'transporte', match: /uber|\b99\b|corrida|taxi/ },
  { key: 'onibus', label: 'Ônibus e metrô', category: 'transporte', match: /onibus|metro\b|bilhete|\btrem\b/ },
  { key: 'viagem', label: 'Viagem', category: 'lazer', match: /viagem|aereo|\bvoo\b|hotel|pousada|hosped/ },
  { key: 'conserto', label: 'Consertos', category: 'outros', match: /conserto|mecanic|oficina|revisao|\bpneu|encanador|eletricista/ },
  { key: 'obra', label: 'Obra e ferramentas', category: 'moradia', match: /\bobra\b|reforma|ferramenta|material de constru|\btinta\b/ },
  { key: 'moveis', label: 'Móveis e decoração', category: 'moradia', match: /movel|moveis|\bsofa\b|decora|colchao/ },
  { key: 'farmacia', label: 'Farmácia', category: 'saude', match: /farmacia|remedio|drogaria|medicament/ },
  { key: 'consulta', label: 'Consultas e exames', category: 'saude', match: /consulta|medic[oa]|dentista|exame|clinica|hospital|terapia|psicolog/ },
  { key: 'academia', label: 'Academia', category: 'saude', match: /academia|pilates|crossfit|natacao/ },
  { key: 'pet', label: 'Pet', category: 'outros', match: /\bpet\b|racao|veterin|banho e tosa/ },
  { key: 'bebe', label: 'Bebê', category: 'outros', match: /\bbebe\b|fralda|creche/ },
  { key: 'roupa', label: 'Roupas', category: 'outros', match: /roupa|camis|\bcalca|tenis|sapato|vestuario/ },
  { key: 'cabelo', label: 'Cabelo e beleza', category: 'outros', match: /cabel|barbe|\bsalao\b|manicure/ },
  { key: 'curso', label: 'Cursos e escola', category: 'outros', match: /\bcurso|escola|faculdade|mensalidade|\baula/ },
  { key: 'livro', label: 'Livros', category: 'lazer', match: /livro|livraria/ },
  { key: 'eletronicos', label: 'Eletrônicos', category: 'outros', match: /notebook|computador|eletronic|monitor|teclado/ },
  { key: 'frete', label: 'Frete e mudança', category: 'outros', match: /\bfrete\b|correios|mudanca|transportadora/ },
  { key: 'tv', label: 'TV e streaming', category: 'lazer', match: /\btv\b|streaming/ },
  { key: 'pix', label: 'Transferência', category: 'outros', match: /\bpix\b|transferencia|emprestimo/ },
  // sem regra de descrição: são os padrões de cada categoria e opções para escolher à mão
  { key: 'casa', label: 'Casa', category: 'moradia' },
  { key: 'compras', label: 'Compras', category: 'mercado' },
  { key: 'conta', label: 'Conta', category: 'contas' },
  { key: 'saude', label: 'Saúde', category: 'saude' },
  { key: 'assinatura', label: 'Assinatura', category: 'assinaturas' },
  { key: 'pacote', label: 'Outros', category: 'outros' },
]

/** Regra que casa com a descrição, ou null quando ela não dá pista. */
export function matchRule(description: string): ExpenseRule | null {
  const key = titleKey(description)
  if (!key) return null
  return EXPENSE_RULES.find((r) => r.match?.test(key)) ?? null
}
