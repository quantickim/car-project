import { useCallback, useMemo } from 'react';
import type { EncarListing } from '../api/types';
import { useLocalStorage } from './useLocalStorage';

export interface Favorite {
  carId: string;
  carName: string;
  listing: EncarListing;
  savedAt: string;
}

export function useFavorites() {
  const [favorites, setFavorites] = useLocalStorage<Favorite[]>('car:favorites', []);
  const ids = useMemo(() => new Set(favorites.map((f) => f.listing.Id)), [favorites]);
  const toggle = useCallback(
    (carId: string, carName: string, listing: EncarListing) =>
      setFavorites((prev) =>
        prev.some((f) => f.listing.Id === listing.Id)
          ? prev.filter((f) => f.listing.Id !== listing.Id)
          : [{ carId, carName, listing, savedAt: new Date().toISOString() }, ...prev],
      ),
    [setFavorites],
  );
  return { favorites, isFavorite: (id: string) => ids.has(id), toggle };
}
