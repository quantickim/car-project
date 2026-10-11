import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNarrow } from '../../hooks/useNarrow';
import { Legend, TooltipBox } from './ChartTooltip';
import { axisProps, chart } from './theme';

export interface RetentionRow {
  name: string;
  r3: number; // %
  r5: number; // %
}

/** 차종별 3년/5년 예상 잔존율. 100%선 = 지금 산 가격 그대로 */
export function RetentionChart({ rows }: { rows: RetentionRow[] }) {
  const narrow = useNarrow();
  // 좁은 화면에서는 브랜드명을 떼고 짧게 표시 (전체 이름은 툴팁에)
  const shortName = (name: string) => {
    const s = name.replace(/^(아우디|BMW|메르세데스-벤츠|메르세데스-AMG|메르세데스|포르쉐|재규어)\s/, '');
    return s.length > 12 ? `${s.slice(0, 11)}…` : s;
  };
  const max = Math.max(125, Math.ceil(Math.max(...rows.map((r) => Math.max(r.r3, r.r5))) / 25) * 25);
  const ticks = Array.from({ length: max / 25 + 1 }, (_, i) => i * 25);
  return (
    <>
      <Legend
        items={[
          { color: chart.series1, label: '3년 후 잔존율' },
          { color: chart.series2, label: '5년 후 잔존율' },
        ]}
      />
      <ResponsiveContainer width="100%" height={rows.length * 44 + 48}>
        <BarChart data={rows} layout="vertical" margin={{ top: 24, right: 24, bottom: 0, left: 0 }} barGap={2} barCategoryGap={10}>
          <CartesianGrid stroke={chart.grid} horizontal={false} />
          <XAxis type="number" domain={[0, max]} ticks={ticks} {...axisProps} tickFormatter={(v: number) => `${v}%`} />
          <YAxis
            type="category"
            dataKey="name"
            {...axisProps}
            axisLine={false}
            width={narrow ? 96 : 180}
            interval={0}
            tickFormatter={narrow ? shortName : undefined}
          />
          <ReferenceLine x={100} stroke={chart.muted} label={{ value: '구매가', position: 'top', fill: chart.muted, fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: 'var(--accent-wash)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as RetentionRow;
              return (
                <TooltipBox
                  title={r.name}
                  rows={[
                    { color: chart.series1, label: '3년 후', value: `${r.r3.toFixed(0)}%` },
                    { color: chart.series2, label: '5년 후', value: `${r.r5.toFixed(0)}%` },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="r3" fill={chart.series1} barSize={12} radius={[0, 4, 4, 0]} isAnimationActive={false} />
          <Bar dataKey="r5" fill={chart.series2} barSize={12} radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}
