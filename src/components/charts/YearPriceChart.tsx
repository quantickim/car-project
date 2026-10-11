import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { YearPrice } from '../../lib/analysis';
import { formatPrice, formatPriceShort } from '../../lib/format';
import { TooltipBox } from './ChartTooltip';
import { axisProps, chart } from './theme';

/** 모델연식별 현재 시세: 중앙값 선 + 25~75% 구간 띠 */
export function YearPriceChart({ data, targetYear }: { data: YearPrice[]; targetYear?: number }) {
  const rows = data.map((d) => ({ ...d, band: [d.p25, d.p75] as [number, number] }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={rows} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={chart.grid} vertical={false} />
        <XAxis dataKey="year" {...axisProps} tickFormatter={(y: number) => `${String(y).slice(2)}년`} />
        <YAxis {...axisProps} axisLine={false} width={56} tickFormatter={formatPriceShort} domain={['auto', 'auto']} />
        {targetYear && (
          <ReferenceLine
            x={targetYear}
            stroke={chart.muted}
            label={{ value: '관심 연식', position: 'top', fill: chart.muted, fontSize: 12 }}
          />
        )}
        <Tooltip
          cursor={{ stroke: chart.axis }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as YearPrice;
            return (
              <TooltipBox
                title={`${d.year}년식 · ${d.count}대`}
                rows={[
                  { color: chart.series1, label: '중앙값', value: `${formatPrice(d.median)}원` },
                  { color: chart.series1, label: '중간 50% 구간', value: `${formatPrice(d.p25)} ~ ${formatPrice(d.p75)}` },
                  { color: chart.axis, label: '최저 ~ 최고', value: `${formatPrice(d.min)} ~ ${formatPrice(d.max)}` },
                ]}
              />
            );
          }}
        />
        <Area dataKey="band" stroke="none" fill={chart.series1} fillOpacity={0.12} isAnimationActive={false} />
        <Line
          dataKey="median"
          stroke={chart.series1}
          strokeWidth={2}
          dot={{ r: 4, fill: chart.series1, stroke: chart.surface, strokeWidth: 2 }}
          activeDot={{ r: 6, fill: chart.series1, stroke: chart.surface, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
