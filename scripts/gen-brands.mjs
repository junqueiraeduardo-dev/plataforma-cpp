// Gera src/features/vault/brandData.ts só com o que o app usa de cada logotipo
// (nome, cor e caminho), a partir da biblioteca simple-icons (licença CC0).
// Para acrescentar uma marca: inclua a linha abaixo e rode `node scripts/gen-brands.mjs`.
import fs from 'node:fs'
import * as si from 'simple-icons'
// Algumas marcas (Microsoft, Amazon, Adobe, Nintendo...) saíram das versões novas da biblioteca;
// para elas vale o desenho da versão 8, instalada com o apelido simple-icons-legacy.
import * as legacy from 'simple-icons-legacy'

// slug da simple-icons → apelidos pelos quais a assinatura é reconhecida
const BRANDS = JSON.parse(fs.readFileSync(new URL('./brands.json', import.meta.url), 'utf8'))

const bySlug = new Map(Object.values(si).filter((i) => i && i.slug).map((i) => [i.slug, i]))
const legacyBySlug = new Map(Object.values(legacy).filter((i) => i && i.slug).map((i) => [i.slug, i]))
// nome pelo qual o serviço é conhecido hoje e cor do aplicativo, quando diferem do registro da biblioteca
const TITLE = { microsoftoffice: 'Microsoft 365', openai: 'ChatGPT', nintendoswitch: 'Nintendo Switch Online', microsoftonedrive: 'OneDrive', adobecreativecloud: 'Creative Cloud', adobephotoshop: 'Photoshop', adobelightroom: 'Lightroom', adobeacrobatreader: 'Acrobat', googlegemini: 'Gemini' }
const HEX = { primevideo: '#00a8e1', nintendo: '#e60012', openai: '#10a37f', amazon: '#ff9900' }
const out = []
for (const [slug, aliases] of Object.entries(BRANDS)) {
  const icon = bySlug.get(slug) ?? legacyBySlug.get(slug)
  if (!icon) {
    console.warn('sem logotipo na biblioteca:', slug)
    continue
  }
  out.push({ slug, title: TITLE[slug] ?? icon.title, hex: HEX[slug] ?? `#${icon.hex.toLowerCase()}`, path: icon.path, aliases })
}
fs.writeFileSync(
  'src/features/vault/brandData.ts',
  `// Gerado por scripts/gen-brands.mjs a partir da simple-icons (licença CC0). Não edite à mão.
export interface BrandData {
  slug: string
  title: string
  /** Cor oficial da marca. */
  hex: string
  /** Caminho SVG em caixa de 24×24, preenchido. */
  path: string
  /** Apelidos pelos quais a assinatura é reconhecida (minúsculas, sem acento). */
  aliases: string[]
}

export const BRAND_DATA: BrandData[] = ${JSON.stringify(out)}
`,
)
console.log(out.length, 'marcas geradas')
