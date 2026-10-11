import type { EncarListing } from '../api/types';
import type { CatalogCar } from '../data/catalog';
import { groupBy, median, quantile, theilSen } from './stats';

export function filterByBadges(listings: EncarListing[], badges?: string[]): EncarListing[] {
  if (!badges?.length) return listings;
  const set = new Set(badges);
  return listings.filter((l) => set.has(l.Badge));
}

/** 최초등록(YYYYMM) 기준 차령(년) */
export function ageYears(l: EncarListing, now = new Date()): number {
  const y = Math.floor(l.Year / 100);
  const m = Math.round(l.Year % 100) || 6;
  return (now.getFullYear() * 12 + now.getMonth() + 1 - (y * 12 + m)) / 12;
}

export interface YearPrice {
  year: number;
  count: number;
  median: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
}

/** 모델연식별 현재 시세 (만원) */
export function priceByFormYear(listings: EncarListing[]): YearPrice[] {
  const groups = groupBy(listings, (l) => Number(l.FormYear) || Math.floor(l.Year / 100));
  return [...groups.entries()]
    .map(([year, ls]) => {
      const prices = ls.map((l) => l.Price).sort((a, b) => a - b);
      return {
        year,
        count: prices.length,
        median: Math.round(quantile(prices, 0.5)),
        min: prices[0],
        max: prices[prices.length - 1],
        p25: Math.round(quantile(prices, 0.25)),
        p75: Math.round(quantile(prices, 0.75)),
      };
    })
    .sort((a, b) => a.year - b.year);
}

export type Confidence = 'high' | 'mid' | 'low';

export interface Depreciation {
  /** 분석에 쓰인 매물 수 (이상치 제외 후) */
  n: number;
  /** 1년 지날 때마다 남는 가치 비율 (1 초과면 연식이 오래될수록 오히려 비쌈) */
  annualFactor: number;
  retention3: number;
  retention5: number;
  medianPrice: number;
  ageSpan: [number, number];
  confidence: Confidence;
  /** 배지 표본이 부족해 유사 트림까지 넓혀 추정했는지 */
  usedPeerFallback: boolean;
}

const MIN_SAMPLES = 4;
const MIN_AGE_SPAN = 1.5;
/** 차령이 1년 이상 차이 나는 매물끼리만 기울기를 계산 */
const MIN_PAIR_DX = 1;

/**
 * 같은 세대·트림 매물의 차령-가격 관계로 감가율을 추정한다.
 *
 * ln(가격) = a + b·차령 을 Theil–Sen 으로 적합하면 exp(b) 가 "1년 더 묵을 때 남는 가치 비율"이다.
 * 차령이 늘면 주행거리도 같이 늘어나므로, 이 값에는 통상적인 주행거리 증가분의 감가도 포함된다.
 * 지금 3년 더 오래된 동일 차량의 시세 = 지금 산 차를 3년 뒤 팔 때의 시세 라고 보는 횡단면 추정이다.
 */
export function estimateDepreciation(
  listings: EncarListing[],
  now = new Date(),
  usedPeerFallback = false,
): Depreciation | null {
  if (listings.length < MIN_SAMPLES) return null;
  let pts = listings.map((l) => ({ x: ageYears(l, now), y: Math.log(l.Price) }));

  // 1차 적합 후 잔차가 큰 매물(사고차, 가격 오기입 등)을 제거하고 다시 적합
  let fit = theilSen(pts.map((p) => p.x), pts.map((p) => p.y), MIN_PAIR_DX);
  const resid = pts.map((p) => p.y - (fit.intercept + fit.slope * p.x));
  const mad = median(resid.map((r) => Math.abs(r - median(resid)))) || 0.05;
  pts = pts.filter((_, i) => Math.abs(resid[i]) <= 3 * 1.4826 * mad);
  if (pts.length < MIN_SAMPLES) return null;

  const ages = pts.map((p) => p.x);
  const span: [number, number] = [Math.min(...ages), Math.max(...ages)];
  if (span[1] - span[0] < MIN_AGE_SPAN) return null;
  fit = theilSen(ages, pts.map((p) => p.y), MIN_PAIR_DX);

  const annualFactor = Math.exp(fit.slope);
  const spread = span[1] - span[0];
  const confidence: Confidence = pts.length >= 20 && spread >= 3 ? 'high' : pts.length >= 8 && spread >= 2 ? 'mid' : 'low';

  return {
    n: pts.length,
    annualFactor,
    retention3: annualFactor ** 3,
    retention5: annualFactor ** 5,
    medianPrice: Math.round(median(pts.map((p) => Math.exp(p.y)))),
    ageSpan: span,
    confidence,
    usedPeerFallback,
  };
}

/** 배지가 정해진 차종은 배지 일치 매물, 표본이 부족하면 `peerKeyword` 를 포함하는 유사 트림까지 넓혀 추정 */
export function analyzeCar(car: CatalogCar, modelListings: EncarListing[], now = new Date()): Depreciation | null {
  const own = filterByBadges(modelListings, car.badges);
  const byBadge = estimateDepreciation(own, now);
  if (byBadge && byBadge.confidence !== 'low') return byBadge;
  if (car.peerKeyword) {
    const peers = modelListings.filter((l) => l.Badge.includes(car.peerKeyword!));
    const byPeers = peers.length > own.length ? estimateDepreciation(peers, now, true) : null;
    if (byPeers && (!byBadge || byPeers.confidence !== 'low')) return byPeers;
  }
  return byBadge;
}

export type ValueGrade = 'rising' | 'strong' | 'normal' | 'weak';

export function gradeOf(retention3: number): ValueGrade {
  if (retention3 >= 1) return 'rising';
  if (retention3 >= 0.8) return 'strong';
  if (retention3 >= 0.65) return 'normal';
  return 'weak';
}

export const GRADE_LABEL: Record<ValueGrade, string> = {
  rising: '가치 상승',
  strong: '방어 우수',
  normal: '보통',
  weak: '감가 큼',
};
