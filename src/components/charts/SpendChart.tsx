import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatAxis, formatBRL } from '@/domain/money'

export interface SpendPoint {
  day: number
  current: number | null
  previous: number | null
}

// o gráfico vive dentro do bloco de marca, que é escuro em qualquer tema
const INK = '#f2f9fa'
const MUTED = '#c5dde2'

/** Gasto acumulado no mês, comparado ao mês anterior e ao teto do orçamento. Um só eixo, em reais. */
export function SpendChart({
  data,
  budget,
  currentLabel,
  previousLabel,
}: {
  data: SpendPoint[]
  budget: number
  currentLabel: string
  previousLabel: string
}) {
  const days = data.length
  const ticks = [1, 5, 10, 15, 20, 25, days].filter((d, i, a) => d <= days && a.indexOf(d) === i && (d === days || days - d >= 2))
  const peak = Math.max(budget, ...data.map((d) => Math.max(d.current ?? 0, d.previous ?? 0)))

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 560, height: 250 }}>
      <ComposedChart data={data} margin={{ top: 14, right: 10, left: 0, bottom: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="oklch(1 0 0 / 9%)" />
        <XAxis
          dataKey="day"
          type="number"
          domain={[1, days]}
          ticks={ticks}
          tickLine={false}
          axisLine={{ stroke: 'oklch(1 0 0 / 22%)' }}
          tick={{ fill: MUTED, fontSize: 12 }}
          tickMargin={6}
        />
        <YAxis
          width={46}
          domain={[0, Math.ceil((peak * 1.08) / 50000) * 50000]}
          tickCount={5}
          tickLine={false}
          axisLine={false}
          tick={{ fill: MUTED, fontSize: 12 }}
          tickFormatter={formatAxis}
        />
        <Tooltip
          cursor={{ stroke: 'oklch(1 0 0 / 45%)', strokeWidth: 1 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const row = payload[0].payload as SpendPoint
            return (
              <div className="rounded-lg border border-foreground/15 bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
                <p className="mb-1.5 text-muted-foreground">Dia {label}</p>
                {row.current !== null && (
                  <p className="flex items-center gap-2">
                    <span className="h-0.5 w-3 rounded-full" style={{ background: 'var(--lime)' }} />
                    <span className="num text-sm font-semibold">{formatBRL(row.current)}</span>
                    <span className="text-muted-foreground">{currentLabel}</span>
                  </p>
                )}
                {row.previous !== null && (
                  <p className="mt-1 flex items-center gap-2">
                    <span className="h-0.5 w-3 rounded-full bg-muted-foreground" />
                    <span className="num text-sm font-semibold">{formatBRL(row.previous)}</span>
                    <span className="text-muted-foreground">{previousLabel}</span>
                  </p>
                )}
              </div>
            )
          }}
        />
        {budget > 0 && (
          <ReferenceLine
            y={budget}
            stroke="oklch(1 0 0 / 50%)"
            strokeDasharray="4 4"
            label={{ value: `Orçamento ${formatAxis(budget)}`, position: 'insideTopLeft', fill: INK, fontSize: 12, dy: -4 }}
          />
        )}
        <Line
          dataKey="previous"
          name={previousLabel}
          stroke="oklch(1 0 0 / 55%)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#ffffff', stroke: 'var(--brand-deep)', strokeWidth: 2 }}
          isAnimationActive={false}
          connectNulls={false}
        />
        <Area
          dataKey="current"
          name={currentLabel}
          stroke="var(--lime)"
          strokeWidth={2}
          strokeLinecap="round"
          fill="var(--lime)"
          fillOpacity={0.12}
          dot={false}
          activeDot={{ r: 4.5, fill: 'var(--lime)', stroke: 'var(--brand-deep)', strokeWidth: 2 }}
          animationDuration={900}
          animationEasing="ease-out"
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
