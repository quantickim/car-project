import { useCallback, useMemo } from 'react';
import { DEFAULT_CATALOG, type CatalogCar } from '../data/catalog';
import { useLocalStorage } from './useLocalStorage';

/** 기본 카탈로그(test.txt) + 사용자가 '차종 관리'에서 추가한 차종 */
export function useCatalog() {
  const [custom, setCustom] = useLocalStorage<CatalogCar[]>('car:custom-catalog', []);
  const catalog = useMemo(() => [...DEFAULT_CATALOG, ...custom], [custom]);
  const addCar = useCallback((car: CatalogCar) => setCustom((prev) => [...prev, { ...car, custom: true }]), [setCustom]);
  const removeCar = useCallback((id: string) => setCustom((prev) => prev.filter((c) => c.id !== id)), [setCustom]);
  const updateCar = useCallback(
    (id: string, patch: Partial<CatalogCar>) => setCustom((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c))),
    [setCustom],
  );
  return { catalog, addCar, removeCar, updateCar };
}
