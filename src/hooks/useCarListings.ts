import { useEffect, useState } from 'react';
import { encar } from '../api/client';
import type { EncarListing } from '../api/types';
import type { CatalogCar } from '../data/catalog';
import { filterByBadges } from '../lib/analysis';

interface State {
  loading: boolean;
  error?: string;
  /** 같은 세대·배지그룹 전체 매물 */
  modelListings: EncarListing[];
  /** 카탈로그 배지와 일치하는 매물 */
  listings: EncarListing[];
}

/** 차종 하나의 현재 전체 매물 (시세 분석용, 조건 필터 없음) */
export function useCarListings(car: CatalogCar | undefined): State {
  const [state, setState] = useState<State>({ loading: false, modelListings: [], listings: [] });

  useEffect(() => {
    if (!car) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    encar
      .searchListings(car.encar)
      .then(({ listings }) => {
        if (alive) setState({ loading: false, modelListings: listings, listings: filterByBadges(listings, car.badges) });
      })
      .catch((e: unknown) => alive && setState({ loading: false, modelListings: [], listings: [], error: String(e) }));
    return () => {
      alive = false;
    };
  }, [car]);

  return state;
}
