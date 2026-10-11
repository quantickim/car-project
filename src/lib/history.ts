import type { EncarListing } from '../api/types';
import { groupBy, median } from './stats';

/**
 * 분석할 때마다 저장하는 차종별 시세 스냅샷.
 * 같은 모델연식 매물의 중앙값을 날짜별로 이어 붙이면 "같은 차가 시간이 지나며 얼마나 변했는지"를 직접 볼 수 있다.
 */
export interface PriceSnapshot {
  /** 기록 시각 (YYYY-MM-DDTHH:mm, 현지 시각). 예전 기록은 YYYY-MM-DD */
  date: string;
  carId: string;
  count: number;
  median: number;
  byYear: Record<string, { median: number; count: number }>;
}

export interface HistoryFile {
  snapshots: PriceSnapshot[];
}

const pad = (n: number) => String(n).padStart(2, '0');

export const nowStamp = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** "2026-10-11T22:40" → "10/11 22:40", "2026-10-11" → "10/11" */
export function formatStamp(stamp: string): string {
  const [date, time] = stamp.split('T');
  const [, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}${time ? ` ${time}` : ''}`;
}

export function makeSnapshot(carId: string, listings: EncarListing[], date = nowStamp()): PriceSnapshot | null {
  if (listings.length === 0) return null;
  const byYear: PriceSnapshot['byYear'] = {};
  for (const [year, ls] of groupBy(listings, (l) => l.FormYear || String(Math.floor(l.Year / 100)))) {
    byYear[year] = { median: Math.round(median(ls.map((l) => l.Price))), count: ls.length };
  }
  return { date, carId, count: listings.length, median: Math.round(median(listings.map((l) => l.Price))), byYear };
}

export function mergeSnapshots(existing: PriceSnapshot[], incoming: PriceSnapshot[]): PriceSnapshot[] {
  const key = (s: PriceSnapshot) => `${s.date}|${s.carId}`;
  const map = new Map(existing.map((s) => [key(s), s]));
  for (const s of incoming) map.set(key(s), s);
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date) || a.carId.localeCompare(b.carId));
}

const MIN_DAYS = 7;
const MIN_COHORT = 2;

/**
 * 기록된 스냅샷으로 본 실제 시세 변동.
 * 매물 구성이 바뀌는 영향을 피하려고 처음과 마지막 스냅샷에 모두 있는 같은 모델연식끼리만 비교한다.
 */
export function observedChange(snaps: PriceSnapshot[]): { days: number; changePct: number; from: string; to: string } | null {
  if (snaps.length < 2) return null;
  const sorted = [...snaps].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const days = (Date.parse(last.date) - Date.parse(first.date)) / 86_400_000;
  if (days < MIN_DAYS) return null;
  const ratios = Object.entries(first.byYear)
    .filter(([y, v]) => v.count >= MIN_COHORT && (last.byYear[y]?.count ?? 0) >= MIN_COHORT)
    .map(([y, v]) => last.byYear[y].median / v.median);
  if (ratios.length === 0) return null;
  return { days: Math.round(days), changePct: (median(ratios) - 1) * 100, from: first.date, to: last.date };
}
