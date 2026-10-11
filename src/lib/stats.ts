export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function median(values: number[]): number {
  return quantile([...values].sort((a, b) => a - b), 0.5);
}

/**
 * Theil–Sen 회귀: 점 쌍 기울기의 중앙값.
 * 허위·이상 매물 몇 개에 휘둘리지 않아서 표본이 작은 중고차 시세에 최소제곱보다 적합하다.
 * x 차이가 아주 작은 쌍은 기울기가 노이즈로 폭주해 중앙값을 0 쪽으로 끌어당기므로 minDx 미만은 제외한다.
 */
export function theilSen(xs: number[], ys: number[], minDx = 0): { slope: number; intercept: number } {
  const slopes: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      const dx = xs[j] - xs[i];
      if (Math.abs(dx) > Math.max(minDx, 1e-6)) slopes.push((ys[j] - ys[i]) / dx);
    }
  }
  const slope = slopes.length ? median(slopes) : 0;
  const intercept = median(ys.map((y, i) => y - slope * xs[i]));
  return { slope, intercept };
}

/** 같은 키끼리 묶기 */
export function groupBy<T, K extends string | number>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = map.get(k);
    if (arr) arr.push(it);
    else map.set(k, [it]);
  }
  return map;
}
