import type { ReactNode } from 'react';

export interface TooltipRow {
  color: string;
  label: string;
  value: ReactNode;
}

/** 값이 먼저, 이름은 보조. 계열 표시는 짧은 선 키 */
export function TooltipBox({ title, rows }: { title?: ReactNode; rows: TooltipRow[] }) {
  return (
    <div className="chart-tooltip">
      {title && <div className="chart-tooltip__title">{title}</div>}
      {rows.map((r) => (
        <div className="chart-tooltip__row" key={r.label}>
          <span className="chart-tooltip__key" style={{ background: r.color }} />
          <strong className="num">{r.value}</strong>
          <span className="chart-tooltip__label">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { color: string; label: string; shape?: 'line' | 'rect' | 'dot' }[] }) {
  return (
    <ul className="chart-legend">
      {items.map((it) => (
        <li key={it.label}>
          <span className={`chart-legend__key chart-legend__key--${it.shape ?? 'rect'}`} style={{ background: it.color }} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}
