// Converte ícones do lucide em uma tabela de caminhos SVG (um "d" por ícone),
// para desenhar o mesmo ícone no React e no <canvas> do grafo.
import fs from 'node:fs'
import path from 'node:path'

const ICONS = [
  ['tv', 'TV e vídeo'], ['clapperboard', 'Filmes'], ['music', 'Música'], ['headphones', 'Áudio'], ['mic', 'Podcast'],
  ['gamepad-2', 'Jogos'], ['cloud', 'Nuvem'], ['code-xml', 'Software'], ['palette', 'Design'], ['camera', 'Fotos'],
  ['smartphone', 'Celular'], ['wifi', 'Internet'], ['lock-keyhole', 'Segurança'], ['shield-check', 'Seguro'],
  ['dumbbell', 'Academia'], ['heart-pulse', 'Saúde'], ['coffee', 'Café'], ['utensils', 'Comida'], ['shopping-bag', 'Compras'],
  ['package', 'Entregas'], ['book-open', 'Leitura'], ['newspaper', 'Notícias'], ['graduation-cap', 'Cursos'],
  ['car', 'Transporte'], ['plane', 'Viagem'], ['house', 'Casa'], ['briefcase', 'Trabalho'], ['zap', 'Energia'],
  ['key-round', 'Acesso'], ['sparkles', 'Outros'],
]
const dir = path.resolve('node_modules/lucide-react/dist/esm/icons')
const n = (v) => Number(v ?? 0)

function toPath(tag, a) {
  if (tag === 'path') return a.d
  if (tag === 'line') return `M${a.x1} ${a.y1}L${a.x2} ${a.y2}`
  if (tag === 'polyline' || tag === 'polygon') {
    const pts = a.points.trim().split(/[\s,]+/)
    let d = ''
    for (let i = 0; i < pts.length; i += 2) d += `${i ? 'L' : 'M'}${pts[i]} ${pts[i + 1]}`
    return tag === 'polygon' ? d + 'Z' : d
  }
  if (tag === 'circle' || tag === 'ellipse') {
    const rx = n(a.r ?? a.rx), ry = n(a.r ?? a.ry), cx = n(a.cx), cy = n(a.cy)
    return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`
  }
  if (tag === 'rect') {
    const x = n(a.x), y = n(a.y), w = n(a.width), h = n(a.height)
    const rx = Math.min(n(a.rx ?? a.ry), w / 2), ry = Math.min(n(a.ry ?? a.rx), h / 2)
    if (!rx && !ry) return `M${x} ${y}h${w}v${h}h${-w}Z`
    return `M${x + rx} ${y}h${w - 2 * rx}a${rx} ${ry} 0 0 1 ${rx} ${ry}v${h - 2 * ry}a${rx} ${ry} 0 0 1 ${-rx} ${ry}h${-(w - 2 * rx)}a${rx} ${ry} 0 0 1 ${-rx} ${-ry}v${-(h - 2 * ry)}a${rx} ${ry} 0 0 1 ${rx} ${-ry}Z`
  }
  throw new Error('elemento não suportado: ' + tag)
}

const out = []
for (const [name, label] of ICONS) {
  let text = fs.readFileSync(path.join(dir, name + '.mjs'), 'utf8')
  // alguns nomes são apelidos que reexportam outro arquivo
  const alias = text.match(/export \{ default \} from '\.\/(.+?)\.mjs'/)
  if (alias) text = fs.readFileSync(path.join(dir, alias[1] + '.mjs'), 'utf8')
  const literal = text.match(/const __iconData = (\{[\s\S]*?\n\});/)
  if (!literal) throw new Error('formato inesperado em ' + name)
  const data = new Function('return ' + literal[1])()
  out.push({ key: name, label, d: data.node.map(([tag, attrs]) => toPath(tag, attrs)).join('') })
}
const body = `// Gerado por scripts/gen-generic-icons.mjs a partir do lucide (licença ISC). Não edite à mão.
// Traço de 2px em uma caixa de 24×24, pontas e junções arredondadas.
export interface GenericIcon {
  key: string
  label: string
  d: string
}

export const GENERIC_ICONS: GenericIcon[] = ${JSON.stringify(out, null, 2)}
`
fs.writeFileSync('src/features/vault/genericIcons.ts', body)
console.log('ícones gerados:', out.length)
