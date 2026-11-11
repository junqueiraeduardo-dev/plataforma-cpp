import { useState } from 'react'
import { normalizeHex } from '@/domain/color'
import { cn } from '@/lib/utils'

/**
 * Seletor de cor: amostra que abre o seletor do sistema + campo de texto com o
 * hexadecimal. O valor só é aceito quando é uma cor válida.
 */
export function ColorField({
  id,
  label,
  value,
  onChange,
  compact = false,
  className,
}: {
  id: string
  label: string
  value: string
  onChange: (hex: string) => void
  compact?: boolean
  className?: string
}) {
  const [text, setText] = useState(value)
  // o texto acompanha o valor quando ele muda por fora (outro seletor, tema pronto)
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    setText(value)
  }
  const invalid = normalizeHex(text) === null

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label className="press relative flex ctl-icon-sm shrink-0 cursor-pointer items-center justify-center rounded-lg focus-within:ring-2 focus-within:ring-ring">
        <span className="sr-only">{label}</span>
        <span aria-hidden="true" className="size-8 rounded-full ring-1 ring-foreground/25" style={{ background: value }} />
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
      {!compact && (
        <input
          id={`${id}-hex`}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            const hex = normalizeHex(e.target.value)
            if (hex) onChange(hex)
          }}
          onBlur={() => setText(value)}
          aria-label={`${label} em hexadecimal`}
          aria-invalid={invalid}
          spellCheck={false}
          maxLength={7}
          className={cn(
            'num ctl-sm w-[6.5rem] md:w-[5.5rem] rounded-lg border bg-transparent px-2 font-mono text-base uppercase md:text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring',
            invalid ? 'border-critical' : 'border-input',
          )}
        />
      )}
    </div>
  )
}
