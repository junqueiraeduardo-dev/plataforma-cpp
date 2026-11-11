import {
  Baby, Beef, Beer, Bike, BookOpen, Building2, Bus, Car, Carrot, Clapperboard, Coffee, Croissant, Droplets, Dumbbell,
  Fish, Flame, Fuel, Gamepad2, Gift, GraduationCap, Hammer, HandCoins, HeartPulse, House, IceCreamCone, KeyRound,
  Lamp, Landmark, Laptop, Lightbulb, Package, PartyPopper, PawPrint, Pill, Pizza, Plane, ReceiptText, Repeat,
  Scissors, Shirt, ShoppingBasket, ShoppingCart, Smartphone, Sofa, SprayCan, SquareParking, Stethoscope, Ticket,
  Truck, Tv, Utensils, WashingMachine, Wifi, Wine, Wrench,
  type LucideIcon,
} from 'lucide-react'
import { EXPENSE_RULES, matchRule } from '@/domain/expenseRules'
import type { CategoryId } from '@/domain/types'

export interface ExpenseIconDef {
  key: string
  label: string
  Icon: LucideIcon
}

// O desenho de cada regra de src/domain/expenseRules.ts (que define a descrição e a categoria).
const ICON_BY_KEY: Record<string, LucideIcon> = {
  aluguel: KeyRound, condominio: Building2, lampada: Lamp, luz: Lightbulb, agua: Droplets, gas: Flame, internet: Wifi,
  celular: Smartphone, imposto: Landmark, limpeza: SprayCan, lavanderia: WashingMachine, feira: Carrot, padaria: Croissant,
  churrasco: Flame, carnes: Beef, mercado: ShoppingCart, pizza: Pizza, japones: Fish, delivery: Bike, bar: Beer, vinho: Wine,
  cafe: Coffee, sorvete: IceCreamCone, restaurante: Utensils, cinema: Clapperboard, ingresso: Ticket, festa: PartyPopper,
  presente: Gift, jogos: Gamepad2, combustivel: Fuel, estacionamento: SquareParking, corrida: Car, onibus: Bus, viagem: Plane,
  conserto: Wrench, obra: Hammer, moveis: Sofa, farmacia: Pill, consulta: Stethoscope, academia: Dumbbell, pet: PawPrint,
  bebe: Baby, roupa: Shirt, cabelo: Scissors, curso: GraduationCap, livro: BookOpen, eletronicos: Laptop, frete: Truck, tv: Tv,
  pix: HandCoins, casa: House, compras: ShoppingBasket, conta: ReceiptText, saude: HeartPulse, assinatura: Repeat, pacote: Package,
}

export const EXPENSE_ICONS: ExpenseIconDef[] = EXPENSE_RULES.map((r) => ({ key: r.key, label: r.label, Icon: ICON_BY_KEY[r.key] ?? Package }))

const byKey = new Map(EXPENSE_ICONS.map((i) => [i.key, i]))

const CATEGORY_DEFAULT: Record<CategoryId, string> = {
  moradia: 'casa',
  mercado: 'compras',
  contas: 'conta',
  transporte: 'corrida',
  lazer: 'festa',
  saude: 'saude',
  assinaturas: 'assinatura',
  outros: 'pacote',
}

/** Ícone automático: pela descrição e, sem pista nela, pelo padrão da categoria. */
export function autoExpenseIcon(description: string, category: CategoryId): ExpenseIconDef {
  return byKey.get(matchRule(description)?.key ?? CATEGORY_DEFAULT[category])!
}

/** Ícone de um gasto: o escolhido à mão, ou o automático. */
export function expenseIcon(expense: { description: string; category_id: CategoryId; icon?: string | null }): ExpenseIconDef {
  return (expense.icon ? byKey.get(expense.icon) : undefined) ?? autoExpenseIcon(expense.description, expense.category_id)
}
