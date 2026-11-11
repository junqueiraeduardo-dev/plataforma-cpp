import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { WIKILINK_RE } from '@/domain/wikilinks'

const PREFIX = '#wikilink:'

/** Modo leitura. O Markdown é renderizado sem HTML bruto; links externos abrem em nova aba. */
export function NoteReader({
  body,
  exists,
  onOpen,
}: {
  body: string
  exists: (title: string) => boolean
  onOpen: (title: string) => void
}) {
  const source = body.replace(
    WIKILINK_RE,
    (_m, target: string, alias?: string) => `[${(alias ?? target).trim()}](${PREFIX}${encodeURIComponent(target.trim())})`,
  )
  if (!body.trim()) {
    return <p className="text-sm text-faint">Nota vazia. Passe para o modo de edição para escrever.</p>
  }
  return (
    <div className="prose-vault">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            if (href?.startsWith(PREFIX)) {
              const target = decodeURIComponent(href.slice(PREFIX.length))
              const found = exists(target)
              return (
                <a
                  href={href}
                  className={found ? 'wikilink' : 'wikilink wikilink-missing'}
                  title={found ? undefined : 'Nota ainda não criada — clique para criar'}
                  onClick={(e) => {
                    e.preventDefault()
                    onOpen(target)
                  }}
                >
                  {children}
                </a>
              )
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            )
          },
        }}
      >
        {source}
      </Markdown>
    </div>
  )
}
