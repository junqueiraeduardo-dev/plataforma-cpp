import { getDaysInMonth } from 'date-fns'
import { fromISO, monthKey, shiftMonth, toISO } from '@/domain/dates'
import { subscriptionExpenses, transactionExpenses } from '@/domain/expenses'
import { computeBalances, simplifyDebts } from '@/domain/settle'
import { itemKey } from '@/domain/shopping'
import { equalSplit } from '@/domain/split'
import type {
  AppData,
  BillingCycle,
  Budget,
  CategoryId,
  ID,
  ISODate,
  MarketSection,
  Member,
  Note,
  NoteKind,
  Product,
  Settlement,
  ShoppingItem,
  Split,
  SubscriptionStatus,
  Transaction,
} from '@/domain/types'

export const MEMBER_COLORS = ['#17bac8', '#ff7350', '#e3b341', '#5fbf8f', '#6aa5f0', '#f08fa8']

export function uid(): ID {
  return crypto.randomUUID()
}

// gerador determinístico: os dados de exemplo são os mesmos a cada restauração
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function emptyData(name = 'Minha casa'): AppData {
  return {
    version: 1,
    household: { id: uid(), name },
    members: [],
    transactions: [],
    budgets: [],
    settlements: [],
    notes: [],
    products: [],
    shopping: [],
  }
}

export function buildSeed(todayISO: ISODate): AppData {
  const rand = mulberry32(20261110)
  const between = (min: number, max: number) => Math.round((min + rand() * (max - min)) * 100)
  const pick = <T,>(list: T[]): T => list[Math.floor(rand() * list.length)]
  const now = new Date().toISOString()
  const household = { id: uid(), name: 'Apê da Vila Madalena' }
  const hid = household.id

  const [ana, bruno, carla]: Member[] = ['Ana', 'Bruno', 'Carla'].map((name, i) => ({
    id: uid(),
    household_id: hid,
    name,
    color: MEMBER_COLORS[i],
    created_at: now,
  }))
  const everyone = [ana.id, bruno.id, carla.id]

  const transactions: Transaction[] = []
  const add = (
    date: ISODate,
    description: string,
    amount: number,
    category_id: CategoryId,
    payer_id: ID,
    split: Split = equalSplit(everyone),
  ) => {
    if (date > todayISO) return
    transactions.push({
      id: uid(),
      household_id: hid,
      date,
      description,
      amount,
      category_id,
      payer_id,
      split,
      created_at: now,
    })
  }

  const current = monthKey(todayISO)
  for (let back = 5; back >= 0; back--) {
    const month = shiftMonth(current, -back)
    const days = getDaysInMonth(fromISO(`${month}-01`))
    const day = (d: number) => `${month}-${String(Math.min(d, days)).padStart(2, '0')}`
    const anyDay = () => day(1 + Math.floor(rand() * days))

    // fixos da casa — o quarto da Ana é maior, então o aluguel não é dividido por igual
    add(day(5), 'Aluguel', 285000, 'moradia', ana.id, {
      mode: 'percent',
      shares: { [ana.id]: 40, [bruno.id]: 30, [carla.id]: 30 },
    })
    add(day(10), 'Condomínio', 54000, 'moradia', ana.id)
    add(day(12), 'Conta de luz', between(165, 265), 'contas', bruno.id)
    add(day(14), 'Conta de água', between(78, 118), 'contas', bruno.id)
    add(day(15), 'Internet fibra 500 MB', 11990, 'contas', carla.id)
    add(day(18), 'Botijão de gás', 11500, 'contas', carla.id)

    const markets = ['Feira de sábado', 'Mercado do mês', 'Hortifruti', 'Atacadão', 'Padaria e frios']
    // compras a cada cinco dias, com um dia de folga para mais ou para menos
    for (let i = 0; i < 6; i++) {
      const d = 3 + i * 5 + Math.floor(rand() * 3) - 1
      add(day(d), pick(markets), between(150, 330), 'mercado', pick(everyone))
    }

    for (let i = 0; i < 4; i++) {
      const who = pick(everyone)
      add(anyDay(), 'Corrida de app', between(16, 48), 'transporte', who, equalSplit([who]))
    }
    add(day(8), 'Combustível', between(190, 260), 'transporte', bruno.id, equalSplit([bruno.id, carla.id]))
    add(day(22), 'Bilhete único', 22000, 'transporte', ana.id, equalSplit([ana.id]))

    const fun = ['Pizza de sexta', 'Cinema', 'Bar com amigos', 'Delivery japonês', 'Churrasco no terraço']
    // o mês atual tem lazer acima do normal, para o painel ter o que alertar
    const outings = back === 0 ? 6 : 4
    for (let i = 0; i < outings; i++) {
      add(anyDay(), pick(fun), between(60, back === 0 ? 210 : 170), 'lazer', pick(everyone))
    }

    add(anyDay(), 'Farmácia', between(35, 140), 'saude', pick(everyone))
    if (back % 2 === 1) {
      add(anyDay(), 'Consulta dentista', 28000, 'saude', carla.id, equalSplit([carla.id]))
    }
    add(anyDay(), pick(['Produtos de limpeza', 'Conserto da torneira', 'Lâmpadas e pilhas']), between(40, 160), 'outros', pick(everyone))
  }

  const budgets: Budget[] = (
    [
      ['moradia', 345000],
      ['mercado', 150000],
      ['contas', 60000],
      ['transporte', 75000],
      ['lazer', 55000],
      ['saude', 35000],
      ['assinaturas', 45000],
      ['outros', 20000],
    ] as [CategoryId, number][]
  ).map(([category_id, limit]) => ({ id: uid(), household_id: hid, category_id, limit }))

  const notes: Note[] = []
  const note = (title: string, kind: NoteKind, body: string, subscription: Note['subscription'] = null) => {
    notes.push({
      id: uid(),
      household_id: hid,
      title,
      kind,
      body,
      subscription,
      created_at: now,
      updated_at: now,
    })
  }

  // data inicial com o dia desejado, alguns meses atrás
  const started = (monthsAgo: number, dayOfMonth: number): ISODate => {
    const base = fromISO(`${shiftMonth(current, -monthsAgo)}-01`)
    const d = Math.min(dayOfMonth, getDaysInMonth(base))
    return toISO(new Date(base.getFullYear(), base.getMonth(), d))
  }
  const sub = (
    title: string,
    price: number,
    cycle: BillingCycle,
    start_date: ISODate,
    payer: Member,
    shared_with: ID[],
    group: string,
    payment_method: string,
    body: string,
    status: SubscriptionStatus = 'active',
    end_date: ISODate | null = null,
  ) =>
    note(title, 'subscription', body, {
      price,
      cycle,
      start_date,
      end_date,
      status,
      payer_id: payer.id,
      shared_with,
      group,
      payment_method,
    })

  sub('Netflix', 4490, 'monthly', started(14, 12), ana, everyone, 'Streaming', 'Cartão Nubank',
    'Plano **Padrão**, duas telas. É o que mais se usa na TV da sala.\n\n- Trocar pelo plano com anúncios economizaria R$ 24 por mês.\n- Decidir na [[Revisão de assinaturas]].')
  sub('Spotify Família', 3490, 'monthly', started(20, 3), bruno, everyone, 'Música', 'Cartão Inter',
    'Seis contas no plano, usamos três.\n\nO [[Bruno]] administra os convites. Sobra vaga para mais gente da família.')
  sub('Disney+', 4390, 'monthly', started(5, 21), carla, [carla.id, ana.id], 'Streaming', 'Cartão Nubank',
    'Assinado por causa de uma série só. Quase ninguém abre desde então.\n\n> Candidata a cancelamento — ver [[Revisão de assinaturas]].')
  sub('Amazon Prime', 16680, 'yearly', started(10, 27), ana, everyone, 'Streaming', 'Cartão Nubank',
    'Plano **anual**. Vale mais pelo frete grátis do que pelo catálogo.\n\nRenova de uma vez só: avisar o pessoal um mês antes para ninguém ser pego de surpresa.')
  sub('YouTube Premium', 2690, 'monthly', started(8, 17), bruno, [bruno.id], 'Streaming', 'Cartão Inter',
    'Individual do [[Bruno]]. Não entra na divisão da casa.')
  sub('iCloud 200 GB', 1490, 'monthly', started(30, 9), carla, [carla.id], 'Software', 'Cartão Nubank',
    'Backup das fotos da [[Carla]]. Está em 162 GB de 200.')
  sub('Google One 100 GB', 899, 'monthly', started(16, 25), ana, [ana.id], 'Software', 'Débito automático',
    'Armazenamento do Gmail e Drive da [[Ana]].')
  sub('Xbox Game Pass', 5999, 'monthly', started(6, 2), bruno, [bruno.id, carla.id], 'Jogos', 'Cartão Inter',
    'Dividido entre [[Bruno]] e [[Carla]], que jogam no console da sala.')
  sub('Smart Fit', 11990, 'monthly', started(9, 6), carla, [carla.id], 'Saúde e bem-estar', 'Débito automático',
    'Plano Black. Fidelidade de 12 meses — conferir a data antes de pensar em cancelar.')
  sub('Clube do café', 6990, 'monthly', started(4, 19), ana, everyone, 'Casa', 'Cartão Nubank',
    'Dois pacotes de 250 g por mês, grão torrado na semana da entrega.\n\nDá para pausar por um mês sem multa quando a casa viaja.')
  sub('Seguro residencial', 48000, 'yearly', started(7, 15), ana, everyone, 'Casa', 'Débito automático',
    'Cobre incêndio, roubo e danos elétricos. Exigido pelo contrato de aluguel.\n\nApólice e contatos na pasta compartilhada.')
  sub('Duolingo Super', 3490, 'monthly', started(11, 23), carla, [carla.id], 'Software', 'Cartão Nubank',
    'Pausada depois da viagem. Reativar se as aulas de espanhol voltarem.', 'paused', started(2, 23))
  sub('Max', 3990, 'monthly', started(13, 11), bruno, everyone, 'Streaming', 'Cartão Inter',
    'Cancelada na última [[Revisão de assinaturas]]: ninguém assistia havia dois meses.', 'cancelled', started(1, 11))

  note('Streaming', 'group', 'Vídeo sob demanda. É onde a casa mais acumula assinaturas esquecidas.')
  note('Música', 'group', 'Áudio e podcasts.')
  note('Software', 'group', 'Armazenamento, aplicativos e ferramentas.')
  note('Jogos', 'group', 'Consoles e catálogos de jogos.')
  note('Casa', 'group', 'Serviços recorrentes do apartamento.')
  note('Saúde e bem-estar', 'group', 'Academia e cuidados pessoais.')

  note('Ana', 'member', 'Cuida do aluguel e das contas anuais. Prefere concentrar tudo no [[Cartão Nubank]].')
  note('Bruno', 'member', 'Responsável por luz e água. Usa o [[Cartão Inter]] pelo cashback.')
  note('Carla', 'member', 'Paga a internet e o gás.')

  note('Cartão Nubank', 'payment', 'Fecha no dia 2, vence no dia 9. Titular: [[Ana]].')
  note('Cartão Inter', 'payment', 'Fecha no dia 20, vence no dia 27. Titular: [[Bruno]].')
  note('Débito automático', 'payment', 'Sai direto da conta corrente — conferir o saldo na véspera.')

  note('Revisão de assinaturas', 'note',
    '# Revisão de assinaturas\n\nA cada três meses a casa passa por todas as assinaturas e decide o que fica.\n\n## Em avaliação\n\n- [[Disney+]] — pouco uso, candidata a sair\n- [[Netflix]] — testar o plano com anúncios\n- [[Clube do café]] — manter, mas pausar nas férias\n\n## Já decidido\n\n- [[Max]] cancelada\n- [[Duolingo Super]] pausada até segunda ordem\n\n## Ideias\n\n- Trocar [[Spotify Família]] por [[Plano Duo]] se sobrar vaga')

  // o que a casa costuma escrever na lista (vira sugestão) e uma lista em andamento
  const products: Product[] = (
    [
      ['Granola da feira', 'mercearia', 6],
      ['Leite sem lactose', 'laticinios', 9],
      ['Café em grão', 'mercearia', 5],
      ['Ração do Thor', 'casa', 4],
      ['Iogurte grego', 'laticinios', 3],
    ] as [string, MarketSection, number][]
  ).map(([name, section, uses]) => ({ id: uid(), household_id: hid, name, section, uses, created_at: now }))
  const shopping: ShoppingItem[] = (
    [
      ['Banana', 'hortifruti', 1, null, false],
      ['Tomate', 'hortifruti', 1, '2 kg', true],
      ['Pão francês', 'padaria', 6, null, false],
      ['Leite sem lactose', 'laticinios', 4, null, true],
      ['Ovos', 'mercearia', 1, null, false],
      ['Café em grão', 'mercearia', 1, null, false],
      ['Granola da feira', 'mercearia', 1, null, false],
      ['Detergente', 'limpeza', 2, null, false],
      ['Papel higiênico', 'higiene', 1, null, false],
    ] as [string, MarketSection, number, string | null, boolean][]
  ).map(([name, section, quantity, detail, checked]) => ({
    id: uid(),
    household_id: hid,
    product_key: itemKey(name, detail),
    name,
    section,
    quantity,
    detail,
    checked,
    created_at: now,
  }))

  // a casa acerta as contas na virada de cada mês: o saldo em aberto é só o do mês atual
  const settlements: Settlement[] = []
  const monthStart = `${current}-01`
  const dayBefore = toISO(new Date(fromISO(monthStart).getTime() - 86_400_000))
  const past = [
    ...transactionExpenses(transactions, '0000-01-01', dayBefore),
    ...subscriptionExpenses(notes, '0000-01-01', dayBefore),
  ]
  for (const t of simplifyDebts(computeBalances(everyone, past, []))) {
    settlements.push({ ...t, id: uid(), household_id: hid, date: monthStart, created_at: `${monthStart}T09:00:00.000Z` })
  }

  return {
    version: 1,
    household,
    members: [ana, bruno, carla],
    transactions,
    budgets,
    settlements,
    notes,
    products,
    shopping,
  }
}
