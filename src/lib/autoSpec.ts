import { encar } from '../api/client';
import type { EncarPath } from '../api/types';
import type { CatalogCar } from '../data/catalog';
import { filterByBadges } from './analysis';
import { formatPrice } from './format';
import { jinaFetcher, lookupSpec } from './specLookup';

const fetchText = jinaFetcher(safeSessionStorage());

/**
 * 엔카 분류·트림만으로 카탈로그 정보를 채운다.
 * 1) 해당 트림 매물에서 연식 분포와 대표 매물을 구하고 2) 엔카 상세에서 영문 차명·연료·신차가를 얻은 뒤
 * 3) auto-data.net 에서 마력·제로백·최고속도·전장/전폭을 찾는다.
 */
export async function resolveCarInfo(path: EncarPath, badges?: string[]): Promise<Partial<CatalogCar>> {
  const { listings } = await encar.searchListings(path);
  const own = filterByBadges(listings, badges);
  if (own.length === 0) throw new Error('현재 매물이 없어 정보를 찾을 수 없습니다');

  const years = own.map((l) => Number(l.FormYear)).filter(Boolean);
  const counts = new Map<number, number>();
  for (const y of years) counts.set(y, (counts.get(y) ?? 0) + 1);
  const yearMode = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];

  // 가장 흔한 연식의 매물을 대표로 상세 조회
  const sample = own.find((l) => Number(l.FormYear) === yearMode) ?? own[0];
  const detail = await encar.fetchVehicle(sample.Id);
  const cat = detail.category;
  const originPrice = cat.originPrice ?? undefined;

  const spec = await lookupSpec(
    {
      manufacturerEn: cat.manufacturerEnglishName,
      modelGroupEn: cat.modelGroupEnglishName,
      modelKo: path.model,
      gradeEn: cat.gradeEnglishName ?? '',
      badgeKo: sample.Badge,
      yearFrom: Math.min(...years),
      yearTo: Math.max(...years),
      yearMode,
      fuelKo: detail.spec.fuelName,
    },
    fetchText,
  ).catch(() => null);

  const memo = [
    spec ? `제원: ${spec.matchedName}` : '제원을 찾지 못했습니다',
    originPrice ? `신차가 ${formatPrice(originPrice)}원` : undefined,
    `매물 ${own.length}대 · ${Math.min(...years)}~${Math.max(...years)}년식`,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    hp: spec?.hp ?? 0,
    zeroTo100: spec?.zeroTo100 ?? 0,
    topSpeed: spec?.topSpeedKmh ? `${spec.topSpeedKmh} km/h` : '-',
    lengthMm: spec?.lengthMm ?? 0,
    widthMm: spec?.widthMm ?? 0,
    targetYear: yearMode,
    description: memo,
    originPrice,
    specSource: spec ? { name: spec.matchedName, url: spec.url } : undefined,
    specStatus: spec ? 'done' : 'failed',
  };
}

function safeSessionStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}
