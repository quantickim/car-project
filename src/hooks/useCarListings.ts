import { useCallback, useEffect, useState } from 'react';
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
export function useCarListings(car: CatalogCar | undefined): State & { refresh: () => Promise<EncarListing[]> } {
  const [state, setState] = useState<State>({ loading: false, modelListings: [], listings: [] });
  const [version, setVersion] = useState(0);

  /** 엔카에서 새로 받아 화면을 갱신하고, 배지 일치 매물을 돌려준다 */
  const refresh = useCallback(async () => {
    if (!car) return [];
    const { listings } = await encar.searchListings(car.encar, undefined, undefined, true);
    setVersion((v) => v + 1);
    return filterByBadges(listings, car.badges);
  }, [car]);

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
  }, [car, version]);

  return { ...state, refresh };
}
