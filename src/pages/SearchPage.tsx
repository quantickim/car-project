import { useMemo, useState } from 'react';
import { encar } from '../api/client';
import type { EncarListing } from '../api/types';
import { ListingCard } from '../components/ListingCard';
import type { CatalogCar } from '../data/catalog';
import type { useFavorites } from '../hooks/useFavorites';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useNarrow } from '../hooks/useNarrow';
import { filterByBadges, priceByFormYear } from '../lib/analysis';
import { formatPrice } from '../lib/format';
import { mapLimit } from '../lib/pool';

interface Filters {
  carIds: string[];
  minHp: number;
  max0100: number;
  priceFrom: string;
  priceTo: string;
  yearFrom: string;
  yearTo: string;
  mileageTo: string;
  sort: 'price' | 'priceDesc' | 'mileage' | 'year' | 'value';
}

const INITIAL: Filters = {
  carIds: [],
  minHp: 0,
  max0100: 10,
  priceFrom: '',
  priceTo: '',
  yearFrom: '',
  yearTo: '',
  mileageTo: '',
  sort: 'value',
};

interface CarResult {
  car: CatalogCar;
  listings: EncarListing[];
  /** 모델연식별 시세 중앙값 (조건 필터 전 전체 매물 기준) */
  medianByYear: Map<string, number>;
  error?: string;
}

const PAGE = 12;

const num = (s: string) => (s.trim() === '' ? undefined : Number(s));

export function SearchPage({ catalog, favorites }: { catalog: CatalogCar[]; favorites: ReturnType<typeof useFavorites> }) {
  const [filters, setFilters] = useLocalStorage<Filters>('car:search-filters', INITIAL);
  const [results, setResults] = useState<CarResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const narrow = useNarrow();
  // 모바일에서는 차종 칩 목록이 길어서, 이미 고른 차종이 있으면 접어 둔다
  const [carsOpen, setCarsOpen] = useState(() => !narrow || filters.carIds.length === 0);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  // 제원 조건(마력·제로백)에 맞는 차종만 선택지로 노출
  const eligible = useMemo(
    () => catalog.filter((c) => c.hp >= filters.minHp && c.zeroTo100 <= filters.max0100),
    [catalog, filters.minHp, filters.max0100],
  );
  const selected = eligible.filter((c) => filters.carIds.includes(c.id));

  const toggleCar = (id: string) =>
    set('carIds', filters.carIds.includes(id) ? filters.carIds.filter((x) => x !== id) : [...filters.carIds, id]);

  async function search() {
    setLoading(true);
    setExpanded({});
    if (narrow) setCarsOpen(false);
    const priceFrom = num(filters.priceFrom);
    const priceTo = num(filters.priceTo);
    const yearFrom = num(filters.yearFrom);
    const yearTo = num(filters.yearTo);
    const mileageTo = num(filters.mileageTo);

    const out = await mapLimit(selected, 2, async (car): Promise<CarResult> => {
      try {
        // 차종 전체 매물을 받아 시세를 계산하고, 조건 필터는 클라이언트에서 적용 (시세 분석 화면과 캐시 공유)
        const { listings } = await encar.searchListings(car.encar);
        const own = filterByBadges(listings, car.badges);
        const medianByYear = new Map(priceByFormYear(own).map((y) => [String(y.year), y.median]));
        const matched = own.filter((l) => {
          const fy = Number(l.FormYear);
          return (
            (priceFrom == null || l.Price >= priceFrom) &&
            (priceTo == null || l.Price <= priceTo) &&
            (yearFrom == null || fy >= yearFrom) &&
            (yearTo == null || fy <= yearTo) &&
            (mileageTo == null || l.Mileage <= mileageTo)
          );
        });
        return { car, listings: matched, medianByYear };
      } catch (e) {
        return { car, listings: [], medianByYear: new Map(), error: String(e) };
      }
    });
    setResults(out);
    setLoading(false);
  }

  const sortListings = (r: CarResult) => {
    const ls = [...r.listings];
    const valueRatio = (l: EncarListing) => l.Price / (r.medianByYear.get(l.FormYear) ?? l.Price);
    switch (filters.sort) {
      case 'price':
        return ls.sort((a, b) => a.Price - b.Price);
      case 'priceDesc':
        return ls.sort((a, b) => b.Price - a.Price);
      case 'mileage':
        return ls.sort((a, b) => a.Mileage - b.Mileage);
      case 'year':
        return ls.sort((a, b) => b.Year - a.Year);
      case 'value':
        return ls.sort((a, b) => valueRatio(a) - valueRatio(b));
    }
  };

  const total = results?.reduce((s, r) => s + r.listings.length, 0) ?? 0;

  return (
    <div className="search-page">
      <section className="filter-panel">
        <div className="filter-panel__row">
          <label className="field">
            최소 출력 (마력)
            <input type="number" min={0} step={10} value={filters.minHp} onChange={(e) => set('minHp', Number(e.target.value) || 0)} />
          </label>
          <label className="field">
            제로백 (초 이하)
            <input type="number" min={2} step={0.1} value={filters.max0100} onChange={(e) => set('max0100', Number(e.target.value) || 10)} />
          </label>
          <label className="field">
            가격 (만원)
            <span className="range-pair">
              <input inputMode="numeric" placeholder="최소" value={filters.priceFrom} onChange={(e) => set('priceFrom', e.target.value)} />~
              <input inputMode="numeric" placeholder="최대" value={filters.priceTo} onChange={(e) => set('priceTo', e.target.value)} />
            </span>
          </label>
          <label className="field">
            연식
            <span className="range-pair">
              <input inputMode="numeric" placeholder="2015" value={filters.yearFrom} onChange={(e) => set('yearFrom', e.target.value)} />~
              <input inputMode="numeric" placeholder="2024" value={filters.yearTo} onChange={(e) => set('yearTo', e.target.value)} />
            </span>
          </label>
          <label className="field">
            주행거리 (km 이하)
            <input inputMode="numeric" placeholder="예: 80000" value={filters.mileageTo} onChange={(e) => set('mileageTo', e.target.value)} />
          </label>
          <label className="field">
            정렬
            <select value={filters.sort} onChange={(e) => set('sort', e.target.value as Filters['sort'])}>
              <option value="value">시세 대비 저렴한 순</option>
              <option value="price">낮은 가격순</option>
              <option value="priceDesc">높은 가격순</option>
              <option value="mileage">짧은 주행순</option>
              <option value="year">최신 연식순</option>
            </select>
          </label>
        </div>

        <div className="filter-panel__cars">
          <div className="filter-panel__cars-head">
            <button className="filter-panel__cars-toggle" onClick={() => setCarsOpen((o) => !o)} aria-expanded={carsOpen}>
              관심 차종 <strong>{selected.length}</strong> / {eligible.length} {carsOpen ? '▴' : '▾'}
            </button>
            <span className="filter-panel__cars-actions">
              <button className="btn btn--small" onClick={() => set('carIds', eligible.map((c) => c.id))}>
                전체 선택
              </button>
              <button className="btn btn--small" onClick={() => set('carIds', [])}>
                선택 해제
              </button>
            </span>
          </div>
          {!carsOpen && selected.length > 0 && (
            <p className="filter-panel__cars-summary muted">{selected.map((c) => c.name).join(', ')}</p>
          )}
          <div className="chips" hidden={!carsOpen}>
            {eligible.map((c) => (
              <button
                key={c.id}
                className={`chip${filters.carIds.includes(c.id) ? ' is-on' : ''}`}
                onClick={() => toggleCar(c.id)}
                aria-pressed={filters.carIds.includes(c.id)}
              >
                {c.name}
                <span className="chip__meta">
                  {c.hp}마력 · {c.zeroTo100}초
                </span>
              </button>
            ))}
            {eligible.length === 0 && <span className="muted">조건에 맞는 차종이 없습니다. 출력/제로백 조건을 완화해 보세요.</span>}
          </div>
        </div>

        <div className="filter-panel__submit">
          <button className="btn btn--primary" disabled={selected.length === 0 || loading} onClick={search}>
            {loading ? '엔카에서 불러오는 중…' : `위시리스트 매물 찾기 (${selected.length}개 차종)`}
          </button>
        </div>
      </section>

      {results && (
        <div className={loading ? 'is-refreshing' : undefined}>
          <div className="section-title">
            <h2>검색 결과 {total.toLocaleString()}대</h2>
            <span className="muted">'시세 대비'는 같은 차종·같은 연식 매물의 가격 중앙값과 비교한 값입니다</span>
          </div>
          {results.map((r) => {
            const ls = sortListings(r);
            const open = expanded[r.car.id];
            return (
              <section key={r.car.id} className="result-group">
                <header className="result-group__head">
                  <h3>{r.car.name}</h3>
                  <span className="muted">
                    {r.error ? (
                      <span className="notice--error">불러오기 실패</span>
                    ) : (
                      <>
                        {ls.length}대
                        {ls.length > 0 && ` · ${formatPrice(Math.min(...ls.map((l) => l.Price)))} ~ ${formatPrice(Math.max(...ls.map((l) => l.Price)))}`}
                      </>
                    )}
                  </span>
                </header>
                {r.car.note && <p className="muted result-group__note">※ {r.car.note}</p>}
                {ls.length === 0 ? (
                  <p className="notice">조건에 맞는 매물이 없습니다.</p>
                ) : (
                  <div className="listing-grid">
                    {(open ? ls : ls.slice(0, PAGE)).map((l) => (
                      <ListingCard
                        key={l.Id}
                        listing={l}
                        marketMedian={r.medianByYear.get(l.FormYear)}
                        favorite={favorites.isFavorite(l.Id)}
                        onToggleFavorite={() => favorites.toggle(r.car.id, r.car.name, l)}
                      />
                    ))}
                  </div>
                )}
                {ls.length > PAGE && (
                  <button className="btn btn--small result-group__more" onClick={() => setExpanded((e) => ({ ...e, [r.car.id]: !open }))}>
                    {open ? '접기' : `${ls.length - PAGE}대 더 보기`}
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
