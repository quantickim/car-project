import type { EncarListing, EncarPath, EncarSearchResponse, Facet, SearchRange, SortKey } from './types';

/**
 * 엔카 검색 API 클라이언트.
 * 브라우저에서는 Vite 프록시(`/encar-api`)를, Node 스크립트에서는 api.encar.com 을 직접 호출한다.
 */
/** Web Storage 중 사용하는 부분 (Node 에서도 타입 검사가 되도록 직접 정의) */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface EncarClientOptions {
  baseUrl: string;
  headers?: Record<string, string>;
  /** 검색 결과를 보관할 저장소 (브라우저: sessionStorage). 새로고침해도 엔카에 다시 요청하지 않는다 */
  storage?: KeyValueStorage;
}

const PAGE_SIZE = 200;
const MAX_LISTINGS = 1000;
const CACHE_TTL_MS = 30 * 60 * 1000;
/** 엔카는 짧은 시간에 요청이 몰리면 429 를 돌려준다 */
const RETRY_DELAYS_MS = [1500, 4000, 10000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 캐시 크기를 줄이려고 화면·분석에 쓰는 필드만 남긴다 */
function slim(l: EncarListing): EncarListing {
  const first = [...(l.Photos ?? [])].sort((a, b) => a.ordering - b.ordering)[0];
  return {
    Id: l.Id,
    Manufacturer: l.Manufacturer,
    Model: l.Model,
    Badge: l.Badge,
    Year: l.Year,
    FormYear: l.FormYear,
    Mileage: l.Mileage,
    Price: l.Price,
    SellType: l.SellType,
    FuelType: l.FuelType,
    OfficeCityState: l.OfficeCityState,
    Photo: l.Photo,
    Photos: first ? [first] : undefined,
  };
}

/** 엔카 쿼리 문법에서 `.` 과 `)` 는 `_` 로 이스케이프한다 (예: "RS7 (4K)" → "RS7 (4K_)") */
const esc = (v: string) => v.replace(/\./g, '_.').replace(/\)/g, '_)');

/** 분류 경로를 엔카 `q` 파라미터의 차종 부분으로 변환 (부분 경로도 가능: 차종 관리 화면에서 사용) */
function pathExpr(p: Partial<EncarPath> & { carType: 'N' | 'Y' }): string {
  const { carType, manufacturer, modelGroup, model, badgeGroup } = p;
  if (!manufacturer) return `CarType.${carType}.`;
  let inner: string;
  if (!modelGroup) inner = `Manufacturer.${esc(manufacturer)}.`;
  else {
    let level: string;
    if (!model) level = `ModelGroup.${esc(modelGroup)}.`;
    else {
      const modelLevel = badgeGroup
        ? `(C.Model.${esc(model)}._.BadgeGroup.${esc(badgeGroup)}.)`
        : `Model.${esc(model)}.`;
      level = `(C.ModelGroup.${esc(modelGroup)}._.${modelLevel})`;
    }
    inner = `(C.Manufacturer.${esc(manufacturer)}._.${level})`;
  }
  return `(C.CarType.${carType}._.${inner})`;
}

function rangeExprs(r: SearchRange = {}): string[] {
  const out: string[] = [];
  const range = (name: string, from?: number, to?: number) => {
    if (from == null && to == null) return;
    out.push(`${name}.range(${from ?? ''}..${to ?? ''}).`);
  };
  range('Year', r.yearFrom != null ? r.yearFrom * 100 : undefined, r.yearTo != null ? r.yearTo * 100 + 12 : undefined);
  range('Price', r.priceFrom, r.priceTo);
  range('Mileage', undefined, r.mileageTo);
  return out;
}

export function buildQuery(path: Partial<EncarPath> & { carType: 'N' | 'Y' }, range?: SearchRange): string {
  return `(And.Hidden.N._.${pathExpr(path)}${rangeExprs(range).map((r) => `_.${r}`).join('')})`;
}

/** 같은 차를 여러 딜러가 올린 복제 매물은 사진 경로가 같으므로 사진 기준으로도 중복 제거 */
function dedupe(list: EncarListing[]): EncarListing[] {
  const seenId = new Set<string>();
  const seenPhoto = new Set<string>();
  return list.filter((l) => {
    if (seenId.has(l.Id)) return false;
    seenId.add(l.Id);
    if (l.Photo) {
      if (seenPhoto.has(l.Photo)) return false;
      seenPhoto.add(l.Photo);
    }
    return true;
  });
}

export function createEncarClient({ baseUrl, headers, storage }: EncarClientOptions) {
  const cache = new Map<string, Promise<unknown>>();

  async function fetchJson<T>(url: string): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, { headers });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 429 && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new Error(res.status === 429 ? '엔카 요청 한도 초과 — 잠시 후 다시 시도하세요' : `엔카 API 오류 ${res.status}`);
    }
  }

  function get<T>(path: string, params: Record<string, string>): Promise<T> {
    const qs = new URLSearchParams(params).toString();
    const url = `${baseUrl}${path}?${qs}`;
    const hit = cache.get(url);
    if (hit) return hit as Promise<T>;
    const p = fetchJson<T>(url);
    cache.set(url, p);
    p.catch(() => cache.delete(url));
    return p;
  }

  type SearchResult = { total: number; listings: EncarListing[] };

  function readStored(key: string): SearchResult | null {
    try {
      const raw = storage?.getItem(key);
      if (!raw) return null;
      const { at, data } = JSON.parse(raw) as { at: number; data: SearchResult };
      return Date.now() - at < CACHE_TTL_MS ? data : null;
    } catch {
      return null;
    }
  }
  function writeStored(key: string, data: SearchResult) {
    try {
      storage?.setItem(key, JSON.stringify({ at: Date.now(), data }));
    } catch {
      /* 용량 초과 등은 무시: 메모리 캐시만 사용 */
    }
  }

  const inflight = new Map<string, Promise<SearchResult>>();

  /** 조건에 맞는 매물을 페이지를 넘겨가며 최대 1000건까지 가져온다 */
  function searchListings(path: EncarPath, range?: SearchRange, sort: SortKey = 'ModifiedDate'): Promise<SearchResult> {
    const key = `encar:${sort}:${buildQuery(path, range)}`;
    const stored = readStored(key);
    if (stored) return Promise.resolve(stored);
    let p = inflight.get(key);
    if (!p) {
      p = fetchListings(path, range, sort).then((r) => {
        writeStored(key, r);
        return r;
      });
      inflight.set(key, p);
      p.finally(() => inflight.delete(key)).catch(() => {});
    }
    return p;
  }

  async function fetchListings(path: EncarPath, range: SearchRange | undefined, sort: SortKey): Promise<SearchResult> {
    const q = buildQuery(path, range);
    const all: EncarListing[] = [];
    let total = 0;
    for (let offset = 0; offset < MAX_LISTINGS; offset += PAGE_SIZE) {
      const data = await get<EncarSearchResponse>('/search/car/list/general', {
        count: 'true',
        q,
        sr: `|${sort}|${offset}|${PAGE_SIZE}`,
      });
      total = data.Count;
      all.push(...data.SearchResults);
      if (data.SearchResults.length < PAGE_SIZE || all.length >= total) break;
    }
    // 리스/렌트 승계 매물은 가격이 인수금이라 시세를 왜곡하므로 일반 판매만 사용
    const listings = dedupe(all)
      .filter((l) => l.SellType === '일반' && l.Price > 0)
      .map(slim);
    return { total, listings };
  }

  /** 부분 경로의 바로 아래 단계 분류 목록 (제조사 → 모델그룹 → 모델 → 배지그룹 → 배지) */
  async function fetchFacets(path: Partial<EncarPath> & { carType: 'N' | 'Y' }): Promise<{ level: string; facets: Facet[] }> {
    const data = await get<{ iNav: { Nodes: NavNode[] } }>('/search/car/list/general', {
      count: 'true',
      q: buildQuery(path),
      inav: '|Metadata|Sort',
    });
    const root = data.iNav.Nodes.find((n) => n.Name === 'CarType');
    return deepestChildren(root?.Facets ?? []) ?? { level: '', facets: [] };
  }

  return { searchListings, fetchFacets };
}

interface NavFacet {
  Value: string;
  Count: number;
  IsSelected: boolean;
  Refinements?: { Nodes: NavNode[] };
}
interface NavNode {
  Name: string;
  Facets?: NavFacet[];
}

/** 선택된 facet을 따라 내려가서, 아직 선택되지 않은 가장 깊은 단계의 후보를 반환 */
function deepestChildren(facets: NavFacet[]): { level: string; facets: Facet[] } | null {
  const selected = facets.find((f) => f.IsSelected);
  const node = selected?.Refinements?.Nodes?.[0];
  if (!node) return null;
  const deeper = deepestChildren(node.Facets ?? []);
  if (deeper) return deeper;
  return {
    level: node.Name,
    facets: (node.Facets ?? []).filter((f) => f.Count > 0).map((f) => ({ value: f.Value, count: f.Count })),
  };
}

/** 대표 사진: 매물마다 001번 사진이 없을 수 있어 실제 사진 목록의 첫 장을 쓴다 */
export function photoUrl(l: Pick<EncarListing, 'Photo' | 'Photos'>): string | undefined {
  const first = [...(l.Photos ?? [])].sort((a, b) => a.ordering - b.ordering)[0];
  const location = first?.location ?? (l.Photo ? `${l.Photo}001.jpg` : undefined);
  return location ? `https://ci.encar.com/carpicture${location}?impolicy=heightRate&rh=192&cw=320&ch=192&cg=Center` : undefined;
}

export const detailUrl = (id: string) => `https://fem.encar.com/cars/detail/${id}`;

export type EncarClient = Pick<ReturnType<typeof createEncarClient>, 'searchListings' | 'fetchFacets'>;
