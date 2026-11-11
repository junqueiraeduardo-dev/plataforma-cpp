import { z } from 'zod'
import type { AppData } from '@/domain/types'

// Espelha as futuras tabelas do Supabase: uma por coleção, todas com household_id.
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data inválida')
const cents = z.number().int().nonnegative()
const id = z.string().min(1)
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'cor inválida')

const categoryId = z.enum([
  'moradia',
  'mercado',
  'contas',
  'transporte',
  'lazer',
  'saude',
  'assinaturas',
  'outros',
])

// só imagens rasterizadas geradas pelo próprio app; SVG fica de fora
const rasterImage = z
  .string()
  .max(200_000)
  .regex(/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/, 'imagem inválida')

const member = z.object({
  id,
  household_id: id,
  name: z.string().min(1).max(60),
  color: z.string(),
  photo: rasterImage.nullable().optional(),
  created_at: z.string(),
})

const transaction = z.object({
  id,
  household_id: id,
  date: isoDate,
  description: z.string().min(1).max(120),
  amount: cents.positive(),
  category_id: categoryId,
  payer_id: id,
  split: z.object({
    mode: z.enum(['equal', 'percent', 'exact']),
    shares: z.record(z.string(), z.number().nonnegative()),
  }),
  icon: z.string().max(40).nullable().optional(),
  created_at: z.string(),
})

const budget = z.object({
  id,
  household_id: id,
  category_id: categoryId,
  limit: cents,
})

const settlement = z.object({
  id,
  household_id: id,
  date: isoDate,
  from_id: id,
  to_id: id,
  amount: cents.positive(),
  created_at: z.string(),
})

const subscription = z.object({
  price: cents,
  cycle: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  start_date: isoDate,
  end_date: isoDate.nullable(),
  status: z.enum(['active', 'paused', 'cancelled']),
  payer_id: id,
  shared_with: z.array(id),
  group: z.string().max(60),
  payment_method: z.string().max(60),
  icon: z.string().max(60).nullable().optional(),
  color: hex.nullable().optional(),
  // só imagens rasterizadas geradas pelo próprio app; SVG fica de fora
  image: z
    .string()
    .max(200_000)
    .regex(/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/, 'imagem inválida')
    .nullable()
    .optional(),
  sort: z.number().nullable().optional(),
})

const note = z.object({
  id,
  household_id: id,
  title: z.string().min(1).max(120),
  kind: z.enum(['subscription', 'group', 'member', 'payment', 'note']),
  body: z.string().max(100_000),
  subscription: subscription.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

const marketSection = z.enum([
  'hortifruti',
  'padaria',
  'laticinios',
  'carnes',
  'mercearia',
  'bebidas',
  'congelados',
  'limpeza',
  'higiene',
  'casa',
  'outros',
])

const product = z.object({
  id,
  household_id: id,
  name: z.string().min(1).max(60),
  section: marketSection,
  uses: z.number().int().nonnegative().optional(),
  created_at: z.string(),
})

const shoppingItem = z.object({
  id,
  household_id: id,
  product_key: z.string().min(1).max(120),
  name: z.string().min(1).max(60),
  section: marketSection,
  quantity: z.number().int().min(1).max(999),
  detail: z.string().max(40).nullable().optional(),
  checked: z.boolean(),
  created_at: z.string(),
})

export const appDataSchema = z.object({
  version: z.literal(1),
  household: z.object({ id, name: z.string().min(1).max(80) }),
  settings: z
    .object({
      theme: z
        .object({ background: hex, card: hex, foreground: hex, primary: hex, brand: hex })
        .partial()
        .optional(),
      category_colors: z.partialRecord(categoryId, hex).optional(),
      vault: z
        .object({
          group_by: z.enum(['group', 'payer', 'none']),
          sort_by: z.enum(['manual', 'price', 'next', 'name']),
        })
        .partial()
        .optional(),
    })
    .optional(),
  members: z.array(member),
  transactions: z.array(transaction),
  budgets: z.array(budget),
  settlements: z.array(settlement),
  notes: z.array(note),
  // coleções novas: backups antigos não as têm, então nascem vazias
  products: z.array(product).default([]),
  shopping: z.array(shoppingItem).default([]),
})

export function parseAppData(raw: unknown): { ok: true; data: AppData } | { ok: false; error: string } {
  const result = appDataSchema.safeParse(raw)
  if (!result.success) {
    const issue = result.error.issues[0]
    const where = issue.path.length ? issue.path.join('.') : 'arquivo'
    return { ok: false, error: `${where}: ${issue.message}` }
  }
  const data = result.data as AppData
  // integridade referencial mínima: quem paga e quem divide precisa existir
  const ids = new Set(data.members.map((m) => m.id))
  for (const t of data.transactions) {
    if (!ids.has(t.payer_id)) return { ok: false, error: `Gasto "${t.description}" aponta para um morador que não existe.` }
    if (Object.keys(t.split.shares).some((k) => !ids.has(k))) {
      return { ok: false, error: `A divisão de "${t.description}" inclui um morador que não existe.` }
    }
  }
  for (const s of data.settlements) {
    if (!ids.has(s.from_id) || !ids.has(s.to_id)) return { ok: false, error: 'Há um acerto entre moradores que não existem.' }
  }
  for (const n of data.notes) {
    if (n.subscription && !ids.has(n.subscription.payer_id)) {
      return { ok: false, error: `A assinatura "${n.title}" aponta para um morador que não existe.` }
    }
  }
  return { ok: true, data }
}
