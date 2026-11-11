import { Beef, Carrot, Croissant, CupSoda, House, Milk, Package, Snowflake, SoapDispenserDroplet, SprayCan, Wheat, type LucideIcon } from 'lucide-react'
import type { MarketSection } from '@/domain/types'
import { titleKey } from '@/domain/wikilinks'

export interface SectionDef {
  id: MarketSection
  name: string
  Icon: LucideIcon
}

// Dicionário de produtos comuns. Não aparece na tela: serve para sugerir enquanto o
// usuário digita e para adivinhar a seção de cada item. Seções na ordem do corredor.
export const SECTIONS: SectionDef[] = [
  { id: 'hortifruti', name: 'Hortifruti', Icon: Carrot },
  { id: 'padaria', name: 'Padaria', Icon: Croissant },
  { id: 'laticinios', name: 'Laticínios e frios', Icon: Milk },
  { id: 'carnes', name: 'Carnes e peixes', Icon: Beef },
  { id: 'mercearia', name: 'Mercearia', Icon: Wheat },
  { id: 'bebidas', name: 'Bebidas', Icon: CupSoda },
  { id: 'congelados', name: 'Congelados', Icon: Snowflake },
  { id: 'limpeza', name: 'Limpeza', Icon: SprayCan },
  { id: 'higiene', name: 'Higiene', Icon: SoapDispenserDroplet },
  { id: 'casa', name: 'Casa e pet', Icon: House },
  { id: 'outros', name: 'Outros', Icon: Package },
]

export const sectionById = new Map(SECTIONS.map((s) => [s.id, s]))

const NAMES: Record<MarketSection, string[]> = {
  hortifruti: [
    'Banana', 'Maçã', 'Laranja', 'Limão', 'Mamão', 'Abacaxi', 'Uva', 'Morango', 'Melancia', 'Abacate', 'Manga',
    'Tomate', 'Cebola', 'Alho', 'Batata', 'Batata-doce', 'Cenoura', 'Alface', 'Couve', 'Brócolis', 'Abobrinha',
    'Pepino', 'Pimentão', 'Mandioca', 'Cheiro-verde', 'Gengibre',
  ],
  padaria: ['Pão francês', 'Pão de forma', 'Pão integral', 'Pão de queijo', 'Bolo', 'Torrada', 'Biscoito de polvilho', 'Bisnaguinha'],
  laticinios: [
    'Leite integral', 'Leite desnatado', 'Manteiga', 'Margarina', 'Queijo muçarela', 'Queijo minas', 'Queijo prato',
    'Requeijão', 'Iogurte natural', 'Iogurte de frutas', 'Creme de leite', 'Leite condensado', 'Presunto', 'Peito de peru', 'Mortadela',
  ],
  carnes: [
    'Peito de frango', 'Coxa de frango', 'Carne moída', 'Alcatra', 'Patinho', 'Costela', 'Linguiça', 'Bacon',
    'Filé de tilápia', 'Salmão', 'Sardinha em lata', 'Atum em lata',
  ],
  mercearia: [
    'Arroz', 'Feijão carioca', 'Feijão preto', 'Macarrão', 'Farinha de trigo', 'Farinha de mandioca', 'Fubá', 'Aveia',
    'Açúcar', 'Sal', 'Café', 'Óleo de soja', 'Azeite', 'Vinagre', 'Molho de tomate', 'Extrato de tomate', 'Maionese',
    'Ketchup', 'Mostarda', 'Ovos', 'Milho em lata', 'Ervilha em lata', 'Granola', 'Cereal matinal', 'Achocolatado',
    'Biscoito recheado', 'Bolacha água e sal', 'Chocolate', 'Amendoim', 'Pipoca', 'Tempero pronto', 'Pimenta-do-reino',
  ],
  bebidas: [
    'Água mineral', 'Água com gás', 'Suco de laranja', 'Suco de uva', 'Refrigerante', 'Chá', 'Água de coco', 'Cerveja',
    'Vinho', 'Energético',
  ],
  congelados: ['Pizza congelada', 'Lasanha congelada', 'Hambúrguer', 'Nuggets', 'Batata frita congelada', 'Sorvete', 'Polpa de fruta', 'Legumes congelados'],
  limpeza: [
    'Detergente', 'Sabão em pó', 'Sabão líquido', 'Amaciante', 'Água sanitária', 'Desinfetante', 'Limpador multiuso',
    'Esponja', 'Saco de lixo', 'Papel-toalha', 'Lustra-móveis', 'Álcool', 'Pano de chão', 'Sabão em barra',
  ],
  higiene: [
    'Papel higiênico', 'Sabonete', 'Xampu', 'Condicionador', 'Creme dental', 'Escova de dente', 'Fio dental',
    'Desodorante', 'Absorvente', 'Cotonete', 'Lâmina de barbear', 'Protetor solar',
  ],
  outros: [],
  casa: ['Ração para cães', 'Ração para gatos', 'Areia para gato', 'Pilhas', 'Lâmpada', 'Papel-alumínio', 'Filme plástico', 'Guardanapo', 'Fósforo', 'Velas'],
}

export interface CatalogProduct {
  key: string
  name: string
  section: MarketSection
}

const slug = (name: string) => titleKey(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export const CATALOG: CatalogProduct[] = SECTIONS.flatMap((s) =>
  NAMES[s.id].map((name) => ({ key: `catalog:${slug(name)}`, name, section: s.id })),
)
