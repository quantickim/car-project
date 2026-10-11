import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { EncarListing } from '../../api/types';
import { formatKm, formatPrice, formatPriceShort } from '../../lib/format';
import { Legend, TooltipBox } from './ChartTooltip';
import { axisProps, chart } from './theme';

/** 주행거리-가격 분포. 관심 연식 매물을 따로 표시 */
export function MileageScatter({ listings, targetYear }: { listings: EncarListing[]; targetYear?: number }) {
  const isTarget = (l: EncarListing) => targetYear != null && Number(l.FormYear) === targetYear;
  const target = listings.filter(isTarget);
  const others = listings.filter((l) => !isTarget(l));
  const dot = (fill: string) => (props: { cx?: number; cy?: number }) => (
    <g>
      <circle cx={props.cx} cy={props.cy} r={12} fill="transparent" />
      <circle cx={props.cx} cy={props.cy} r={4.5} fill={fill} stroke={chart.surface} strokeWidth={2} />
    </g>
  );
  return (
    <>
      {target.length > 0 && (
        <Legend
          items={[
            { color: chart.series2, label: `${targetYear}년식`, shape: 'dot' },
            { color: chart.series1, label: '기타 연식', shape: 'dot' },
          ]}
        />
      )}
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={chart.grid} />
          <XAxis type="number" dataKey="Mileage" name="주행거리" {...axisProps} tickFormatter={formatKm} />
          <YAxis type="number" dataKey="Price" name="가격" {...axisProps} axisLine={false} width={56} tickFormatter={formatPriceShort} domain={['auto', 'auto']} />
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const l = payload[0].payload as EncarListing;
              return (
                <TooltipBox
                  title={`${l.FormYear}년식 ${l.Badge}`}
                  rows={[
                    { color: isTarget(l) ? chart.series2 : chart.series1, label: '가격', value: `${formatPrice(l.Price)}원` },
                    { color: chart.axis, label: '주행', value: formatKm(l.Mileage) },
                  ]}
                />
              );
            }}
          />
          <Scatter data={others} shape={dot(chart.series1)} isAnimationActive={false} />
          <Scatter data={target} shape={dot(chart.series2)} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </>
  );
}
