import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { Decoration, type DecorationSet, EditorView, MatchDecorator, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import CodeMirror from '@uiw/react-codemirror'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useThemeColors } from '@/store/selectors'

const highlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: '1.55em', fontWeight: '600', letterSpacing: '-0.02em' },
  { tag: t.heading2, fontSize: '1.22em', fontWeight: '600', letterSpacing: '-0.015em' },
  { tag: [t.heading3, t.heading4], fontSize: '1.05em', fontWeight: '600' },
  { tag: t.strong, fontWeight: '600' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.quote, color: 'var(--muted-foreground)' },
  { tag: [t.link, t.url], color: 'var(--brand)' },
  { tag: t.monospace, fontFamily: 'var(--font-mono)', fontSize: '0.88em' },
  { tag: [t.processingInstruction, t.meta, t.contentSeparator], color: 'var(--faint)' },
])

const WIKILINK = /\[\[([^[\]|\n]+?)(?:\|([^[\]\n]+?))?\]\]/g

/**
 * Editor Markdown (CodeMirror 6, a mesma base do Obsidian) com [[wikilinks]]:
 * coloridos conforme a nota existe ou não, autocompletar ao digitar "[[" e
 * Ctrl/Cmd + clique para seguir o link.
 */
export function NoteEditor({
  value,
  onChange,
  titles,
  exists,
  onOpen,
}: {
  value: string
  onChange: (value: string) => void
  titles: string[]
  exists: (title: string) => boolean
  onOpen: (title: string) => void
}) {
  const { dark } = useThemeColors()
  // as extensões ficam estáveis; os dados mais recentes chegam por refs
  const titlesRef = useRef(titles)
  const existsRef = useRef(exists)
  const openRef = useRef(onOpen)
  useLayoutEffect(() => {
    titlesRef.current = titles
    existsRef.current = exists
    openRef.current = onOpen
  })

  const extensions = useMemo(() => {
    const decorator = new MatchDecorator({
      regexp: WIKILINK,
      decoration: (match) =>
        Decoration.mark({
          class: existsRef.current(match[1]) ? 'cm-wikilink' : 'cm-wikilink cm-wikilink-missing',
          attributes: { 'data-target': match[1].trim(), title: 'Ctrl/Cmd + clique para abrir' },
        }),
    })
    const wikilinks = ViewPlugin.fromClass(
      class {
        decorations: DecorationSet
        constructor(view: EditorView) {
          this.decorations = decorator.createDeco(view)
        }
        update(update: ViewUpdate) {
          this.decorations = decorator.updateDeco(update, this.decorations)
        }
      },
      { decorations: (plugin) => plugin.decorations },
    )

    const complete = (context: CompletionContext): CompletionResult | null => {
      const before = context.matchBefore(/\[\[[^[\]\n]*/)
      if (!before) return null
      return {
        from: before.from + 2,
        validFor: /^[^[\]\n]*$/,
        options: titlesRef.current.map((title) => ({
          label: title,
          apply: (view, _completion, from, to) => {
            // os colchetes de fechamento podem já existir (fechamento automático)
            const closed = view.state.sliceDoc(to, to + 2) === ']]'
            view.dispatch({
              changes: { from, to, insert: closed ? title : `${title}]]` },
              selection: { anchor: from + title.length + 2 },
            })
          },
        })),
      }
    }

    const follow = EditorView.domEventHandlers({
      mousedown(event) {
        if (!(event.ctrlKey || event.metaKey)) return false
        const el = (event.target as HTMLElement).closest<HTMLElement>('.cm-wikilink')
        const target = el?.dataset.target
        if (!target) return false
        event.preventDefault()
        openRef.current(target)
        return true
      },
    })

    return [
      markdown(),
      syntaxHighlighting(highlight),
      EditorView.lineWrapping,
      wikilinks,
      autocompletion({ override: [complete], icons: false }),
      follow,
      EditorView.contentAttributes.of({ 'aria-label': 'Texto da nota em Markdown' }),
    ]
  }, [])

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={dark ? 'dark' : 'light'}
      placeholder="Escreva em Markdown. Digite [[ para ligar a outra nota."
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        highlightSelectionMatches: false,
        autocompletion: false,
        searchKeymap: false,
      }}
      minHeight="14rem"
    />
  )
}
