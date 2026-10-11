/** 만원 → "1억 2,300만" */
export function formatPrice(manwon: number): string {
  if (!Number.isFinite(manwon)) return '-';
  const eok = Math.floor(manwon / 10000);
  const rest = Math.round(manwon % 10000);
  if (eok === 0) return `${rest.toLocaleString()}만`;
  return rest === 0 ? `${eok}억` : `${eok}억 ${rest.toLocaleString()}만`;
}

/** 축 눈금용 짧은 표기: 12,300 → "1.2억", 4,500 → "4,500" */
export function formatPriceShort(manwon: number): string {
  return manwon >= 10000 ? `${(manwon / 10000).toFixed(1).replace(/\.0$/, '')}억` : manwon.toLocaleString();
}

export const formatKm = (km: number) => (km >= 10000 ? `${(km / 10000).toFixed(1).replace(/\.0$/, '')}만km` : `${km.toLocaleString()}km`);

export const formatPct = (ratio: number, digits = 0) => `${(ratio * 100).toFixed(digits)}%`;

export const formatSignedPct = (pct: number, digits = 1) => `${pct > 0 ? '+' : ''}${pct.toFixed(digits)}%`;

/** 202108 → "21/08" */
export const formatRegDate = (yyyymm: number) => {
  const y = Math.floor(yyyymm / 100);
  const m = Math.round(yyyymm % 100);
  return `${String(y).slice(2)}/${String(m).padStart(2, '0')}`;
};
