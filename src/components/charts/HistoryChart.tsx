import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PriceSnapshot } from '../../lib/history';
import { formatPrice, formatPriceShort } from '../../lib/format';
import { Legend, TooltipBox } from './ChartTooltip';
import { axisProps, chart, SERIES } from './theme';

const MAX_COHORTS = 4;

/** 기록된 날짜별 시세. 매물이 많은 모델연식 최대 4개를 각각 선으로 추적 */
export function HistoryChart({ snapshots }: { snapshots: PriceSnapshot[] }) {
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const cohorts = Object.entries(latest.byYear)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, MAX_COHORTS)
    .map(([y]) => y)
    .sort();
  const rows = sorted.map((s) => ({
    date: s.date,
    ...Object.fromEntries(cohorts.map((y) => [y, s.byYear[y]?.median])),
  }));
  const color = (i: number) => SERIES[i % SERIES.length];

  return (
    <>
      <Legend items={cohorts.map((y, i) => ({ color: color(i), label: `${y}년식`, shape: 'line' as const }))} />
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={rows} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={chart.grid} vertical={false} />
          <XAxis dataKey="date" {...axisProps} tickFormatter={(d: string) => d.slice(5).replace('-', '/')} />
          <YAxis {...axisProps} axisLine={false} width={56} tickFormatter={formatPriceShort} domain={['auto', 'auto']} />
          <Tooltip
            cursor={{ stroke: chart.axis }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <TooltipBox
                  title={label}
                  rows={cohorts
                    .map((y, i) => ({ y, i, v: (payload[0].payload as Record<string, number>)[y] }))
                    .filter((r) => r.v != null)
                    .map((r) => ({ color: color(r.i), label: `${r.y}년식`, value: `${formatPrice(r.v)}원` }))}
                />
              );
            }}
          />
          {cohorts.map((y, i) => (
            <Line
              key={y}
              dataKey={y}
              stroke={color(i)}
              strokeWidth={2}
              connectNulls
              dot={{ r: 4, fill: color(i), stroke: chart.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}
