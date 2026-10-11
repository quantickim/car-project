/** Recharts 에 넘길 색상. CSS 변수라서 라이트/다크 전환이 자동으로 반영된다 */
export const chart = {
  series1: 'var(--series-1)',
  series2: 'var(--series-2)',
  series3: 'var(--series-3)',
  series4: 'var(--series-4)',
  surface: 'var(--surface)',
  grid: 'var(--grid)',
  axis: 'var(--axis)',
  muted: 'var(--text-muted)',
} as const;

/** 고정 순서로 배정하는 범주형 색 (순위가 아니라 대상에 색이 붙는다) */
export const SERIES = [chart.series1, chart.series2, chart.series3, chart.series4];

export const axisProps = {
  stroke: chart.axis,
  tick: { fill: chart.muted, fontSize: 12 },
  tickLine: false,
} as const;
